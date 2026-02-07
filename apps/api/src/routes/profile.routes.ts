import { Router } from "express";
import { db, whatsappSessions, users } from "@whatsapp-blast/database";
import { whatsappInstances } from "@whatsapp-blast/whatsapp";
import { eq } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs/promises";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper to get session ID from request
function getSessionId(req: any): string | null {
  return req.cookies?.session_id || req.headers["x-session-id"] as string || null;
}

// GET /api/profile - Get WhatsApp profile
// CRITICAL: Reads from users table (persists across sessions), with fallback to whatsappSessions
router.get("/", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Find the session to get the userId (phone-based)
    const session = await db.query.whatsappSessions.findFirst({
      where: eq(whatsappSessions.browserSessionId, sessionId),
    });

    if (!session) {
      return res.json({
        phoneNumber: null,
        displayName: null,
        about: null,
        profilePicUrl: null,
        status: "not_connected",
      });
    }

    // Get user profile from users table (persists across sessions)
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    // Get WhatsApp instance for fresh profile data AND check actual connection status
    const instanceKey = session.userId || sessionId;
    let freshProfile: any = null;
    let actualStatus = session.status; // Default to database status

    // Check actual in-memory connection status (more reliable than database)

    // Debug: Log what instance key we're looking for
    console.log(`[Profile] Looking for instance with key: ${instanceKey}`);

    // Import to check actual instances in memory
    const { whatsappInstances } = await import("@whatsapp-blast/whatsapp");
    console.log(`[Profile] All instance keys in memory:`, Array.from(whatsappInstances.keys()));

    // Get the instance directly from the Map (not through getWhatsAppInstance which might create new one)
    const wa = (whatsappInstances as Map<string, any>).get(instanceKey);

    if (!wa) {
      console.log(`[Profile] No instance found for key ${instanceKey}`);
      actualStatus = "disconnected";
    } else {
      const isActuallyConnected = wa.isConnected();
      console.log(`[Profile] Instance found, isConnected: ${isActuallyConnected}`);
      console.log(`[Profile] Connection active: ${(wa as any).connectionActive}, socket.user exists: ${(wa as any).socket?.user !== undefined}`);

      // Update status based on actual connection
      if (isActuallyConnected) {
        actualStatus = "connected";
        // Also update database if status is stale
        if (session.status !== "connected") {
          db.update(whatsappSessions)
            .set({ status: "connected" })
            .where(eq(whatsappSessions.id, session.id))
            .then(() => console.log(`[Profile] Updated database status to "connected"`))
            .catch(() => {}); // Ignore error
        }

        try {
          freshProfile = await wa.getFullProfile();
        } catch (e) {
          // Ignore error, use cached data
        }
      } else {
        actualStatus = "disconnected";
      }
    }

    // Priority: users table > whatsappSessions > WhatsApp fresh data
    const displayName = user?.displayName || session.displayName || freshProfile?.displayName || null;
    const about = user?.about || session.about || freshProfile?.about || null;
    const profilePicUrl = user?.profilePicUrl || session.profilePicUrl || freshProfile?.profilePicUrl || null;

    console.log(`[Profile] For user ${session.userId}:`, { displayName, about, actualStatus });

    res.json({
      phoneNumber: session.phoneNumber,
      displayName,
      about,
      profilePicUrl,
      status: actualStatus, // Use actual connection status, not database status
    });
  } catch (error) {
    console.error("Error getting profile:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

// PATCH /api/profile - Update display name & about
// IMPORTANT: Saves to users table (persists across sessions), not whatsappSessions
router.patch("/", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { displayName, about } = req.body;

    // First find the session to get the userId (phone-based)
    const session = await db.query.whatsappSessions.findFirst({
      where: eq(whatsappSessions.browserSessionId, sessionId),
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // CRITICAL: Update users table (phone-based), not whatsappSessions
    // This ensures profile data persists across logins/sessions
    const [updated] = await db
      .update(users)
      .set({
        displayName,
        about,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId)) // Use phone-based userId
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`[Profile] Updated profile for user ${session.userId}:`, { displayName, about });

    res.json({
      displayName: updated.displayName,
      about: updated.about,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// POST /api/profile/photo - Update profile picture
router.post("/photo", upload.single("photo"), async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No photo uploaded" });
    }

    // Save file
    const userDataPath = path.join(process.cwd(), "data", sessionId, "uploads");
    await fs.mkdir(userDataPath, { recursive: true });

    const filename = `profile-${Date.now()}.${req.file.mimetype.split("/")[1]}`;
    const filePath = path.join(userDataPath, filename);
    await fs.writeFile(filePath, req.file.buffer);

    const profilePicUrl = `/data/${sessionId}/uploads/${filename}`;

    await db
      .update(whatsappSessions)
      .set({
        profilePicUrl,
        updatedAt: new Date(),
      })
      .where(eq(whatsappSessions.browserSessionId, sessionId));

    // TODO: Update via WhatsApp engine (would require updating profile on WhatsApp itself)

    res.json({ profilePicUrl });
  } catch (error) {
    console.error("Error updating photo:", error);
    res.status(500).json({ error: "Failed to update photo" });
  }
});

// GET /api/profile/refresh - Force refresh profile from WhatsApp
router.get("/refresh", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Find the session to get the userId
    const session = await db.query.whatsappSessions.findFirst({
      where: eq(whatsappSessions.browserSessionId, sessionId),
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Get instance directly from Map
    const instanceKey = session.userId || sessionId;
    const wa = (whatsappInstances as Map<string, any>).get(instanceKey);

    if (!wa || !wa.isConnected()) {
      return res.status(400).json({ error: "WhatsApp not connected" });
    }

    const profile = await wa.getFullProfile();

    // Update database
    await db
      .update(whatsappSessions)
      .set({
        displayName: profile.displayName,
        about: profile.about,
        profilePicUrl: profile.profilePicUrl,
        updatedAt: new Date(),
      })
      .where(eq(whatsappSessions.browserSessionId, sessionId));

    res.json({
      phoneNumber: profile.phoneNumber,
      displayName: profile.displayName,
      about: profile.about,
      profilePicUrl: profile.profilePicUrl,
      status: "connected",
    });
  } catch (error) {
    console.error("Error refreshing profile:", error);
    res.status(500).json({ error: "Failed to refresh profile" });
  }
});

export default router;
