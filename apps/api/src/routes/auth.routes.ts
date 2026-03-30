import { Router } from "express";
import { db, whatsappSessions, users } from "@whatsapp-blast/database";
import { getFreshWhatsAppInstance, getWhatsAppInstance, removeWhatsAppInstance, hasActiveInstance, whatsappInstances } from "@whatsapp-blast/whatsapp";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { Server } from "socket.io";
import path from "path";
import fs from "fs/promises";
import { processBotMessage, BotResponse } from "../services/bot-processor.service.js";
import { saveMessage } from "../services/message-storage.service.js";
import { getRealUserId, getSessionId } from "../utils/get-user.js";
import { insertReturningOne } from "../utils/db-compat.js";
import { handleDbError, sendDbUnavailable } from "../utils/db-errors.js";
import { getDbStatusMessage, isDbAvailable } from "../utils/db-state.js";

const router = Router();

// Store Socket.io instance (will be set from index.ts)
let io: Server | null = null;

export function setSocketIO(socketIO: Server) {
  io = socketIO;
}

// Helper to check if a value is "empty" (null, undefined, or empty string)
// Type guard: narrows type to exclude null/undefined
function isEmpty(value: string | null | undefined): value is null | undefined | "" {
  return value === null || value === undefined || value === "";
}

// Helper to get the first non-empty value from a list
function coalesce(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    if (!isEmpty(value)) return value as string | null;
  }
  return null;
}

// Helper: Normalize phone number for user ID
function normalizePhoneNumber(phone: string): string {
  // Remove all non-numeric characters and add wa: prefix
  const cleaned = phone.replace(/\D/g, '');
  return `wa:${cleaned}`;
}

// Helper: Ensure user exists - PHONE NUMBER is the user identity
async function ensureUserExists(phoneNumber: string) {
  const userId = normalizePhoneNumber(phoneNumber);

  // Check if user exists with this phone number
  let user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    // Create new user with phone number as ID
    const newUser = await insertReturningOne(users, {
      id: userId,
      name: `User ${phoneNumber}`,
      email: `${userId}@whatsapp.local`,
      dataPath: `/data/${userId}`,
    });
    console.log(`[Auth] Created new user: ${userId} for phone: ${phoneNumber}`);
    user = newUser;
  }

  return user;
}

// GET /api/auth/session - Get or create browser session
router.get("/session", async (req, res) => {
  try {
    let sessionId = getSessionId(req);

    // Create new session if none exists
    if (!sessionId) {
      sessionId = createId();
      // Set cookie with appropriate settings for production
      const isProduction = process.env.NODE_ENV === "production";

      // For cross-domain setup (dev.owlscottage.com -> api-dev.owlscottage.com)
      // we need SameSite=None and Secure=true, plus a shared domain
      res.cookie("session_id", sessionId, {
        httpOnly: false, // Allow JavaScript to read the cookie
        secure: isProduction, // Only send over HTTPS in production
        sameSite: isProduction ? "none" : "lax", // 'none' for cross-domain in production
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: "/",
        domain: isProduction ? ".owlscottage.com" : undefined, // Share across all owlscottage.com subdomains
      });
      console.log(`[Auth] Created new session: ${sessionId} (sameSite=${isProduction ? "none" : "lax"})`);
    }

    // Check if this session has a connected WhatsApp (by browserSessionId)
    const existingSession = await db.query.whatsappSessions.findFirst({
      where: eq(whatsappSessions.browserSessionId, sessionId),
    });

    res.json({
      sessionId,
      connected: existingSession?.status === "connected",
      phoneNumber: existingSession?.phoneNumber || null,
      displayName: existingSession?.displayName || null,
    });
  } catch (error) {
    if (handleDbError(error, "Auth")) {
      return sendDbUnavailable(res);
    }
    console.error("Error getting session:", error);
    res.status(500).json({ error: "Failed to get session" });
  }
});

// GET /api/auth/qr - Get current QR code
router.get("/qr", async (req, res) => {
  try {
    if (!isDbAvailable()) {
      return res.status(503).json({
        status: "db_unavailable",
        qr: null,
        message: getDbStatusMessage(),
      });
    }

    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "No session" });
    }

    const session = await db.query.whatsappSessions.findFirst({
      where: eq(whatsappSessions.browserSessionId, sessionId),
    });

    if (!session) {
      return res.json({ status: "not_initialized", qr: null });
    }

    return res.json({
      status: session.status,
      qr: session.qrCode,
      phoneNumber: session.phoneNumber,
    });
  } catch (error) {
    if (handleDbError(error, "Auth")) {
      return sendDbUnavailable(res);
    }
    console.error("Error getting QR:", error);
    res.status(500).json({ error: "Failed to get QR code" });
  }
});

// GET /api/auth/status - Check current session status
router.get("/status", async (req, res) => {
  try {
    if (!isDbAvailable()) {
      return res.status(503).json({
        connected: false,
        status: "db_unavailable",
        phoneNumber: null,
        displayName: null,
        profilePicUrl: null,
        message: getDbStatusMessage(),
      });
    }

    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.json({
        connected: false,
        status: "no_session",
        phoneNumber: null,
        displayName: null,
        profilePicUrl: null,
      });
    }

    let session = await db.query.whatsappSessions.findFirst({
      where: eq(whatsappSessions.browserSessionId, sessionId),
    });

    // Fallback: check by userId (for sessions created before browserSessionId was added)
    if (!session) {
      session = await db.query.whatsappSessions.findFirst({
        where: eq(whatsappSessions.userId, sessionId),
      });
      // If found by userId, update it to have browserSessionId for future lookups
      if (session) {
        await db
          .update(whatsappSessions)
          .set({ browserSessionId: sessionId })
          .where(eq(whatsappSessions.id, session.id));
        console.log(`[Auth] Backfilled browserSessionId for session ${session.id}`);
      }
    }

    if (!session) {
      return res.json({
        connected: false,
        status: "not_initialized",
        phoneNumber: null,
        displayName: null,
        profilePicUrl: null,
      });
    }

    // ALSO check in-memory instance status (more reliable than database)
    // IMPORTANT: Use session.userId (phone-based) instead of sessionId because instances
    // are keyed by phone number after connection (e.g., wa:601111530402)
    const instanceKey = session.userId || sessionId; // Prefer userId (phone number)

    // Get instance directly from Map (not through getWhatsAppInstance which might create new one)
    let wa = (whatsappInstances as Map<string, any>).get(instanceKey);
    let isActuallyConnected = wa ? wa.isConnected() : false;

    console.log(`[Auth] Checking connection for key ${instanceKey}: instance exists=${!!wa}, connected=${isActuallyConnected}`);
    console.log(`[Auth] Session info: status=${session.status}, phoneNumber=${session.phoneNumber}, userId=${session.userId}`);

    // AUTO-RECONNECT: If session exists in DB but instance not in memory, try to restore
    // This happens after server restart - sessions are saved but instances are lost
    // More lenient condition: try reconnect if there's a phone number and saved session, regardless of DB status
    if (!isActuallyConnected && session.phoneNumber) {
      console.log(`[Auth] Session has phone number but no instance - attempting auto-reconnect for ${session.userId}`);

      const dataPath = process.env.DATA_PATH || "./data";

      // IMPORTANT: Session files are saved under browserSessionId (UUID), not userId (phone-based)
      // We need to use browserSessionId to locate the actual session files
      const sessionFolderName = session.browserSessionId || session.userId;
      const sessionPath = path.join(dataPath, sessionFolderName, "sessions", "baileys");

      console.log(`[Auth] Looking for session files at: ${sessionPath}`);
      console.log(`[Auth] browserSessionId=${session.browserSessionId}, userId=${session.userId}`);

      try {
        // Check if saved session exists
        await fs.access(path.join(sessionPath, "creds.json"));
        console.log(`[Auth] ✅ Found saved session, creating instance with folder=${sessionFolderName}`);

        // CRITICAL: Create instance with browserSessionId (where files actually are)
        // NOT with userId (phone-based) because that's where the files are saved
        wa = getWhatsAppInstance(sessionFolderName, dataPath);

        // Register bot handler
        wa.setBotHandler(async (instanceUserId: string, message: {
          from: string;
          fromMe: boolean;
          body: string;
          timestamp: number;
        }) => {
          console.log(`[${instanceUserId}] 🤖 Bot handler (auto-reconnect): message="${message.body}"`);
          // Use phone-based userId for bot processing
          const response = await botHandlerWithSaving(session.userId, message);
          return response;
        });

        // Start connection (will restore from saved session)
        console.log(`[Auth] 🔄 Starting WhatsApp connection...`);
        wa.connect().catch((err: any) => {
          console.error(`[Auth] Auto-reconnect error:`, err);
        });

        // Wait a bit for connection to establish (increased from 3s to 5s)
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check connection status again
        isActuallyConnected = wa.isConnected();
        console.log(`[Auth] Auto-reconnect result: connected=${isActuallyConnected}`);

        if (isActuallyConnected) {
          // Move instance to phone-based userId key (for consistency with other services)
          if (sessionFolderName !== session.userId) {
            console.log(`[Auth] Moving instance from ${sessionFolderName} to ${session.userId}`);
            (whatsappInstances as Map<string, any>).set(session.userId, wa);
            (whatsappInstances as Map<string, any>).delete(sessionFolderName);
          }

          // Update DB to connected status
          await db
            .update(whatsappSessions)
            .set({ status: "connected", lastConnectedAt: new Date() })
            .where(eq(whatsappSessions.id, session.id));
          console.log(`[Auth] ✅ Auto-reconnect successful! Updated DB status to connected`);
        } else {
          // If still not connected, update DB
          await db
            .update(whatsappSessions)
            .set({ status: "disconnected" })
            .where(eq(whatsappSessions.id, session.id));
          console.log(`[Auth] ❌ Auto-reconnect failed - Updated DB to disconnected`);
        }
      } catch (err: any) {
        console.log(`[Auth] No saved session found or auto-reconnect failed:`, err?.message || err);
        // Update DB to reflect actual state
        await db
          .update(whatsappSessions)
          .set({ status: "disconnected" })
          .where(eq(whatsappSessions.id, session.id));
      }
    } else {
      console.log(`[Auth] Skipping auto-reconnect: isActuallyConnected=${isActuallyConnected}, phoneNumber=${!!session.phoneNumber}`);
    }

    // CRITICAL: Get user profile from users table (persists across sessions!)
    // This fixes the issue where setup popup shows after logout/login
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    // Priority: users table > whatsappSessions for profile data
    const finalDisplayName = user?.displayName || session.displayName || null;
    const finalAbout = user?.about || session.about || null;
    const finalProfilePicUrl = user?.profilePicUrl || session.profilePicUrl || null;

    // Update database status if there's a mismatch
    if (isActuallyConnected && session.status !== "connected") {
      console.log(`[Auth] Instance is connected but DB says "${session.status}" - updating DB`);
      await db
        .update(whatsappSessions)
        .set({ status: "connected" })
        .where(eq(whatsappSessions.id, session.id));
    } else if (!isActuallyConnected && session.status === "connected") {
      console.log(`[Auth] Instance is disconnected but DB says "connected" - updating DB`);
      await db
        .update(whatsappSessions)
        .set({ status: "disconnected" })
        .where(eq(whatsappSessions.id, session.id));
    }

    return res.json({
      connected: isActuallyConnected,
      status: isActuallyConnected ? "connected" : session.status,
      phoneNumber: session.phoneNumber,
      displayName: finalDisplayName,  // From users table (persists across sessions)
      about: finalAbout,                // From users table (persists across sessions)
      profilePicUrl: finalProfilePicUrl, // From users table (persists across sessions)
      lastConnectedAt: session.lastConnectedAt,
    });
  } catch (error) {
    if (handleDbError(error, "Auth")) {
      return sendDbUnavailable(res);
    }
    console.error("Error getting status:", error);
    res.status(500).json({ error: "Failed to get status" });
  }
});

// POST /api/auth/connect - Initialize WhatsApp connection
router.post("/connect", async (req, res) => {
  try {
    if (!isDbAvailable()) {
      return res.status(503).json({
        status: "db_unavailable",
        qr: null,
        message: getDbStatusMessage(),
      });
    }

    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "No session. Please refresh the page." });
    }

    // Use session ID as user ID
    const userId = sessionId;

    // Check if already has an active connection (check by browserSessionId or userId)
    const existingSession = await db.query.whatsappSessions.findFirst({
      where: eq(whatsappSessions.browserSessionId, userId),
    });

    if (existingSession && existingSession.status === "connected") {
      return res.json({ 
        status: "connected", 
        sessionId: existingSession.id,
        phoneNumber: existingSession.phoneNumber,
        message: "Already connected"
      });
    }

    // Check if WhatsApp instance is already connecting
    if (hasActiveInstance(userId)) {
      console.log(`[${userId}] Already has active WhatsApp connection`);
      return res.json({
        status: existingSession?.status || "connecting",
        sessionId: existingSession?.id,
        message: "Connection in progress"
      });
    }

    // CRITICAL FIX: Delete ALL old sessions for this browserSessionId before creating new one
    // This prevents session buildup and ensures only one active session per browser
    const allBrowserSessions = await db.query.whatsappSessions.findMany({
      where: eq(whatsappSessions.browserSessionId, sessionId),
    });

    for (const oldSession of allBrowserSessions) {
      console.log(`[Auth] Deleting old session ${oldSession.id} for browser ${sessionId}`);
      await db.delete(whatsappSessions).where(eq(whatsappSessions.id, oldSession.id)).execute();
    }

    // Create or update session record
    let session = existingSession;
    if (!session) {
      // First, ensure user exists for this sessionId
      try {
        await db.insert(users).values({
          id: userId,
          name: `Session User`,
          email: `${userId}@session.local`,
          dataPath: `/data/${userId}`,
        });
      } catch {
        // User already exists, ignore
      }

      const newSession = await insertReturningOne(whatsappSessions, {
        id: createId(),
        userId,
        browserSessionId: sessionId, // Track the browser session for lookups
        status: "qr_pending",
      });
      session = newSession;
    } else {
      await db
        .update(whatsappSessions)
        .set({ status: "qr_pending" })
        .where(eq(whatsappSessions.id, session.id));
    }

    const dataPath = process.env.DATA_PATH || "./data";

    // Check if there's an existing saved session we can restore
    // Don't clear session folders - let Baileys try to restore the saved session first!
    const browserSessionPath = path.join(dataPath, userId, "sessions", "baileys");
    let hasExistingSession = false;
    let sessionUserId = userId; // The userId to use for the instance

    try {
      const credsPath = path.join(browserSessionPath, "creds.json");
      await fs.access(credsPath);
      hasExistingSession = true;
      console.log(`[${userId}] ✅ Found existing session, will try to restore`);
    } catch {
      console.log(`[${userId}] 📱 No browser session, checking phone-based session...`);

      // Check if there's a phone-based session from previous connection
      if (existingSession && existingSession.phoneNumber) {
        const cleanedPhone = existingSession.phoneNumber.replace(/\D/g, '');
        const phoneUserId = `wa:${cleanedPhone}`;
        const phoneSessionPath = path.join(dataPath, phoneUserId, "sessions", "baileys");
        try {
          const credsPath = path.join(phoneSessionPath, "creds.json");
          await fs.access(credsPath);
          hasExistingSession = true;
          sessionUserId = phoneUserId; // Use phone-based userId
          console.log(`[${userId}] ✅ Found phone-based session for ${phoneUserId}, will restore`);
        } catch {
          console.log(`[${userId}] 📱 No phone-based session found`);
        }
      }
    }

    // CRITICAL FIX: Disconnect old instance FIRST and wait for cleanup
    // This prevents the "Manually disconnecting" -> 401 error issue
    if (hasActiveInstance(userId) || hasActiveInstance(sessionUserId)) {
      console.log(`[${userId}] Found active instance, disconnecting first...`);
      await removeWhatsAppInstance(userId);
      await removeWhatsAppInstance(sessionUserId);
      // Wait a bit for disconnect to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Get WhatsApp instance (not fresh - try to restore existing session)
    let wa;
    if (hasExistingSession) {
      // Try to restore existing instance
      console.log(`[${userId}] 🔄 Restoring existing instance with userId: ${sessionUserId}`);
      wa = getWhatsAppInstance(sessionUserId, dataPath);
    } else {
      // Create fresh instance for new connection
      console.log(`[${userId}] 🆕 Creating new instance`);
      wa = await getFreshWhatsAppInstance(userId, dataPath);
    }

    // Track the real user ID (phone-based) for bot message processing
    let realUserId: string | null = null;

    // Setup event handlers
    wa.removeAllListeners();

    wa.on("qr", async (qrDataUrl: string) => {
      console.log(`[${userId}] 📱 QR received`);

      await db
        .update(whatsappSessions)
        .set({ qrCode: qrDataUrl, status: "qr_ready" })
        .where(eq(whatsappSessions.browserSessionId, userId));

      if (io) {
        io.to(`session:${userId}`).emit("whatsapp_qr", { qr: qrDataUrl });
      }
    });

    wa.on("connected", async (phoneNumber: string, pushName: string) => {
      console.log(`[${userId}] ✅ Connected:`, phoneNumber, pushName);

      // IMPORTANT: User ID is now based on phone number, not session ID!
      realUserId = normalizePhoneNumber(phoneNumber);
      console.log(`[${userId}] 📱 Real user ID: ${realUserId} (phone: ${phoneNumber})`);
      console.log(`[${userId}] 🔄 Moving WhatsApp instance from key "${userId}" to "${realUserId}"`);

      // CRITICAL FIX: Move the WhatsApp instance to be keyed by the phone-based userId
      // This ensures the blast service can find the instance by phone number
      if (userId !== realUserId) {
        const existingInstance = (whatsappInstances as Map<string, any>).get(realUserId);
        if (existingInstance) {
          // Remove old instance with same phone number
          console.log(`[${userId}] 🗑️ Removing old instance for ${realUserId}`);
          existingInstance.disconnect();
          (whatsappInstances as Map<string, any>).delete(realUserId);
        }
        // Move current instance to new key
        (whatsappInstances as Map<string, any>).set(realUserId, wa);
        (whatsappInstances as Map<string, any>).delete(userId);
        console.log(`[${userId}] ✅ Instance moved: ${userId} -> ${realUserId}`);
        console.log(`[${userId}] 📋 All instance keys:`, Array.from((whatsappInstances as Map<string, any>).keys()));

        // IMPORTANT: Re-register bot handler with the correct phone-based userId
        // This ensures the bot uses the phone-based userId for config lookups
        const botUserId = realUserId; // Capture for closure
        wa.setBotHandler(async (_instanceUserId: string, message: {
          from: string;
          fromMe: boolean;
          body: string;
          timestamp: number;
        }) => {
          console.log(`[${botUserId}] 🤖 Bot handler called: message="${message.body}"`);

          // Process bot message using the phone-based userId (with saving)
          const response = await botHandlerWithSaving(botUserId, message);

          if (response) {
            console.log(`[${botUserId}] 🤖 Bot responding to ${message.from}: "${response.substring(0, 50)}${response.length > 50 ? "..." : ""}"`);
          }

          return response;
        });
        console.log(`[${userId}] 🤖 Bot handler re-registered with userId: ${realUserId}`);
      }

      // Fetch full profile data
      let about: string | null = null;
      let profilePicUrl: string | null = null;

      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const profile = await wa.getFullProfile();
        about = (profile.about || null) as string | null;
        profilePicUrl = profile.profilePicUrl;
        console.log(`[${userId}] Profile fetched:`, { about, profilePicUrl: profilePicUrl ? "yes" : "no" });
      } catch (profileError) {
        console.error(`[${userId}] Error fetching profile:`, profileError);
        about = null;
      }

      // Ensure user exists (create if not)
      await ensureUserExists(phoneNumber);

      // Check for existing session with this phone number (for profile data)
      const existingWaSession = await db.query.whatsappSessions.findFirst({
        where: eq(whatsappSessions.phoneNumber, phoneNumber),
      });

      // Check the current session (browser session that just connected)
      const currentSession = await db.query.whatsappSessions.findFirst({
        where: eq(whatsappSessions.userId, userId),
      });

      console.log(`[${userId}] 🔍 Existing session:`, existingWaSession ? `YES (user: ${existingWaSession.userId})` : 'NO');
      console.log(`[${userId}] 🔍 Current session:`, currentSession ? `YES (${currentSession.id})` : 'NO');

      // PRIORITY ORDER for displayName:
      // 1. Existing saved displayName from any session with this phone
      // 2. WhatsApp pushName
      // 3. WhatsApp about/bio
      let finalDisplayName: string | null = null;
      let finalAbout: string | null = about || null;
      let finalProfilePicUrl = profilePicUrl;

      // Try to get displayName from existing session with this phone number
      if (existingWaSession && !isEmpty(existingWaSession.displayName)) {
        finalDisplayName = existingWaSession.displayName;
        if (!isEmpty(existingWaSession.about)) {
          finalAbout = existingWaSession.about;
        }
        if (existingWaSession.profilePicUrl) {
          finalProfilePicUrl = existingWaSession.profilePicUrl;
        }
        console.log(`[${userId}] 📋 Using profile from existing session: "${finalDisplayName}"`);
      }

      // If still no displayName, check current session (reconnection case)
      if (isEmpty(finalDisplayName) && currentSession && !isEmpty(currentSession.displayName)) {
        finalDisplayName = currentSession.displayName;
        if (!isEmpty(currentSession.about)) {
          finalAbout = currentSession.about;
        }
        console.log(`[${userId}] 📋 Using profile from current session (reconnect): "${finalDisplayName}"`);
      }

      // If still no displayName, use WhatsApp data
      if (isEmpty(finalDisplayName)) {
        finalDisplayName = coalesce(pushName, about);
        console.log(`[${userId}] 📋 Using WhatsApp data: "${finalDisplayName || "(null)"}"`);
      }

      console.log(`[${userId}] 💾 Final profile:`, {
        userId: realUserId,
        phoneNumber,
        displayName: finalDisplayName,
        about: finalAbout,
      });

      // Update current session to use phone-number-based userId
      // If currentSession doesn't exist (e.g., reconnection with saved session), update existingWaSession instead
      const sessionToUpdate = currentSession || existingWaSession;

      if (sessionToUpdate) {
        await db
          .update(whatsappSessions)
          .set({
            userId: realUserId, // IMPORTANT: Use phone-based user ID!
            browserSessionId: userId, // Track browser session for lookups
            status: "connected",
            phoneNumber,
            displayName: finalDisplayName,
            about: finalAbout,
            profilePicUrl: finalProfilePicUrl,
            qrCode: null,
            lastConnectedAt: new Date(),
          })
          .where(eq(whatsappSessions.id, sessionToUpdate.id));
      } else {
        // No session exists at all - create a new one
        console.log(`[${userId}] ⚠️ No session found, creating new session record`);
        const newSession = await insertReturningOne(whatsappSessions, {
          id: createId(),
          userId: realUserId,
          browserSessionId: userId,
          status: "connected",
          phoneNumber,
          displayName: finalDisplayName,
          about: finalAbout,
          profilePicUrl: finalProfilePicUrl,
          lastConnectedAt: new Date(),
        });
        console.log(`[${userId}] ✅ Created new session: ${newSession.id}`);
      }

      // Also update any other session with same phone to keep in sync
      if (existingWaSession && sessionToUpdate && existingWaSession.id !== sessionToUpdate.id) {
        await db
          .update(whatsappSessions)
          .set({
            userId: realUserId,
            status: "connected",
            displayName: finalDisplayName,
            about: finalAbout,
            profilePicUrl: finalProfilePicUrl,
            lastConnectedAt: new Date(),
            browserSessionId: existingWaSession.browserSessionId || userId,
          })
          .where(eq(whatsappSessions.id, existingWaSession.id));
        console.log(`[${userId}] 🔄 Synced existing session ${existingWaSession.id}`);
      }

      // Emit to the CURRENT browser session
      if (io) {
        io.to(`session:${userId}`).emit("whatsapp_connected", {
          phoneNumber,
          pushName: finalDisplayName,
        });
      }
    });

    wa.on("disconnected", async (reason: string) => {
      console.log(`[${userId}] ❌ Disconnected:`, reason);

      await db
        .update(whatsappSessions)
        .set({ status: "disconnected", qrCode: null })
        .where(eq(whatsappSessions.browserSessionId, userId));

      if (io) {
        io.to(`session:${userId}`).emit("whatsapp_disconnected", { reason });
      }
    });

    // Register initial bot handler (will be re-registered after connection with correct userId)
    // This placeholder handles messages before phone number is known
    wa.setBotHandler(async (instanceUserId: string, message: {
      from: string;
      fromMe: boolean;
      body: string;
      timestamp: number;
    }) => {
      console.log(`[InitialBotHandler] 🔔 Called: instanceUserId=${instanceUserId}, message="${message.body}"`);

      // Try to find the phone-based userId from database
      // First try by browserSessionId, then by userId (phone-based), then by phoneNumber
      let session = await db.query.whatsappSessions.findFirst({
        where: eq(whatsappSessions.browserSessionId, instanceUserId),
      });

      if (!session) {
        // Try finding by userId (phone-based like wa:601111530402)
        session = await db.query.whatsappSessions.findFirst({
          where: eq(whatsappSessions.userId, instanceUserId),
        });
        if (session) {
          console.log(`[InitialBotHandler] 📱 Found session by userId: ${instanceUserId}`);
        }
      }

      if (!session) {
        // Try finding by matching phoneNumber without wa: prefix
        const cleanPhone = instanceUserId.replace('wa:', '');
        const allSessions = await db.query.whatsappSessions.findMany();
        session = allSessions.find(s => s.phoneNumber?.replace(/\D/g, '') === cleanPhone.replace(/\D/g, ''));
        if (session) {
          console.log(`[InitialBotHandler] 📱 Found session by phoneNumber match: ${cleanPhone} -> ${session.phoneNumber}`);
        }
      }

      let botUserId = instanceUserId;
      if (session?.phoneNumber) {
        botUserId = normalizePhoneNumber(session.phoneNumber);
        console.log(`[InitialBotHandler] 📱 Found session with phone: ${session.phoneNumber} -> normalized: ${botUserId}`);
      } else {
        console.log(`[InitialBotHandler] ⚠️ No session found for instanceUserId: ${instanceUserId}. Using instanceUserId as-is.`);
      }

      console.log(`[${instanceUserId}] 🤖 Bot handler (initial): userId=${botUserId}, message="${message.body}"`);

      const response = await botHandlerWithSaving(botUserId, message);
      return response;
    });

    // Start connection
    wa.connect();

    return res.json({ status: "initializing", sessionId: session.id });
  } catch (error) {
    console.error("Error connecting:", error);
    res.status(500).json({ error: "Failed to initialize connection" });
  }
});

// POST /api/auth/logout - Disconnect WhatsApp session and DELETE session record
router.post("/logout", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "No session" });
    }

    // Find the session first
    const session = await db.query.whatsappSessions.findFirst({
      where: eq(whatsappSessions.browserSessionId, sessionId),
    });

    if (session) {
      console.log(`[Auth] Logout: Deleting session ${session.id} for userId: ${session.userId}`);

      // Disconnect WhatsApp instance (by userId - phone number)
      await removeWhatsAppInstance(session.userId);
      // Also try to remove by sessionId in case instance keyed by sessionId
      await removeWhatsAppInstance(sessionId);

      // DELETE the session record completely
      // User account (based on phone number) is kept
      await db.delete(whatsappSessions).where(eq(whatsappSessions.id, session.id)).execute();

      console.log(`[Auth] Logout: Session deleted, user account ${session.userId} preserved`);
    }

    return res.json({ status: "logged_out" });
  } catch (error) {
    console.error("Error logging out:", error);
    res.status(500).json({ error: "Failed to logout" });
  }
});

// GET /api/auth/userid - Get the current user's real userId (for Socket.io room joining)
router.get("/userid", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "No session" });
    }

    const userId = await getRealUserId(sessionId);
    return res.json({ userId });
  } catch (error) {
    console.error("Error getting userId:", error);
    res.status(500).json({ error: "Failed to get userId" });
  }
});

// POST /api/auth/reset-all - Delete all users and sessions (for reset)
router.post("/reset-all", async (_req, res) => {
  try {
    // Delete all whatsapp sessions
    await db.delete(whatsappSessions).execute();

    // Delete all users
    await db.delete(users).execute();

    console.log("✅ All users and sessions reset");

    return res.json({ success: true, message: "All users and sessions deleted" });
  } catch (error) {
    console.error("Error resetting:", error);
    res.status(500).json({ error: "Failed to reset" });
  }
});

// Wrapper for bot handler that also saves messages to database
async function botHandlerWithSaving(userId: string, message: {
  from: string;
  fromMe: boolean;
  body: string;
  timestamp: number;
  senderName?: string;
  waMessageId?: string;
  messageKey?: any;  // Full message key for deleting messages
}): Promise<string | null> {
  console.log(`[botHandlerWithSaving] 📨 Received: userId=${userId}, from=${message.from}, fromMe=${message.fromMe}, senderName="${message.senderName}", body="${message.body}"`);

  // Save ALL messages with correct fromMe flag (incoming AND outgoing)
  if (message.body) {
    const result = await saveMessage(userId, message.from, message.body, message.fromMe, message.timestamp, message.senderName, message.waMessageId);
    console.log(`[botHandlerWithSaving] 💾 Save result:`, result ? `conversationId=${result.conversation.id}, messageId=${result.message.id}, fromMe=${message.fromMe}` : 'null/failed');
  }

  // Process bot message for auto-reply
  const botResponse: BotResponse = await processBotMessage(userId, message);

  // If command says to edit the original message, edit it
  if (botResponse.editOriginal && message.messageKey) {
    console.log(`[botHandlerWithSaving] ✏️ Editing command message in chat...`);
    const wa = whatsappInstances.get(userId);
    if (wa && wa.editMessage) {
      await wa.editMessage(message.messageKey, botResponse.editOriginal);
    } else {
      console.log(`[botHandlerWithSaving] ⚠️ Could not edit message - no WhatsApp instance or editMessage method`);
    }
  }

  // If there's an AI reply, save it to database with isFromAi=true and token data
  // This saves BEFORE WhatsApp sends it, so when the message event fires, it will be detected as duplicate
  if (botResponse.reply && !message.fromMe) {
    // Use the actual cost calculated by processAIMode (based on model pricing)
    // Fallback to calculation if cost not provided (shouldn't happen with AI mode)
    const aiCost = botResponse.cost || ((botResponse.inputTokens || 0) / 1_000_000 * 0.5 + (botResponse.outputTokens || 0) / 1_000_000 * 1.5).toFixed(4);
    // Generate a unique ID for this AI reply for deduplication when WhatsApp event fires
    const aiReplyId = `ai_${Date.now()}_${userId.substring(3)}`;
    await saveMessage(
      userId,
      message.from,
      botResponse.reply,
      true,  // fromMe=true (outgoing)
      Date.now(),
      undefined,
      aiReplyId,  // Use unique ID for deduplication
      true,  // isFromAi=true
      botResponse.inputTokens || 0,
      botResponse.outputTokens || 0,
      aiCost
    );
    console.log(`[botHandlerWithSaving] 🤖 AI reply saved to DB - tokens: ${botResponse.inputTokens}in + ${botResponse.outputTokens}out, cost: RM ${aiCost}`);
  }

  // Return the reply (if any)
  return botResponse.reply;
}

export default router;
