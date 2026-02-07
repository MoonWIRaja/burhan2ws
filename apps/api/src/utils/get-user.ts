import { db, whatsappSessions } from "@whatsapp-blast/database";
import { eq } from "drizzle-orm";

/**
 * Get the real user ID for a session.
 *
 * This enables cross-device data sharing:
 * - If the session has a connected WhatsApp with a phone number
 * - And there's an existing session with the same phone number
 * - Return the ORIGINAL session's user ID
 * - This way, all devices with the same WhatsApp account share the same data
 *
 * @param sessionId - The browser session ID from cookie/header
 * @returns The real user ID to use for data operations
 */
export async function getRealUserId(sessionId: string): Promise<string> {
  // First, check if this session has a WhatsApp session (by browserSessionId)
  let currentWaSession = await db.query.whatsappSessions.findFirst({
    where: eq(whatsappSessions.browserSessionId, sessionId),
  });

  // Fallback: check by userId (for sessions created before browserSessionId was added)
  if (!currentWaSession) {
    currentWaSession = await db.query.whatsappSessions.findFirst({
      where: eq(whatsappSessions.userId, sessionId),
    });
    // If found by userId, update it to have browserSessionId for future lookups
    if (currentWaSession) {
      await db
        .update(whatsappSessions)
        .set({ browserSessionId: sessionId })
        .where(eq(whatsappSessions.id, currentWaSession.id));
    }
  }

  // If no WhatsApp session, return the session ID as-is
  if (!currentWaSession || !currentWaSession.phoneNumber) {
    return sessionId;
  }

  // Return the userId (which is now the phone-based user ID after connection)
  return currentWaSession.userId;
}

/**
 * Get session ID from request (cookie or header)
 */
export function getSessionId(req: any): string | null {
  return req.cookies?.session_id || req.headers["x-session-id"] as string || null;
}

/**
 * Get the real user ID from a request
 * Combines getSessionId + getRealUserId
 */
export async function getUserIdFromRequest(req: any): Promise<string | null> {
  const sessionId = getSessionId(req);
  if (!sessionId) {
    return null;
  }
  return getRealUserId(sessionId);
}
