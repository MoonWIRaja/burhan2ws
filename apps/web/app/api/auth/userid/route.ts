import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://0.0.0.0:3001";

function getSessionId(request: NextRequest): string | null {
  return request.cookies.get("session_id")?.value || null;
}

// GET /api/auth/userid - Get current user ID (phone-based userId from backend)
export async function GET(request: NextRequest) {
  const sessionId = getSessionId(request);

  try {
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Call backend to get the actual userId (phone-based like wa:601111530402)
    const backendResponse = await fetch(`${API_URL}/api/auth/status`, {
      method: "GET",
      headers: {
        "Cookie": `session_id=${sessionId}`,
      },
    });

    if (backendResponse.ok) {
      const sessionData = await backendResponse.json();

      // If WhatsApp is connected, use phone-based userId (wa:601111530402)
      // Otherwise use sessionId
      const userId = sessionData.phoneNumber ? `wa:${sessionData.phoneNumber}` : sessionId;

      console.log("[userid] Backend session data:", sessionData);
      console.log("[userid] Returning userId:", userId);

      return NextResponse.json({
        userId: userId,
        connected: sessionData.connected || false,
        phoneNumber: sessionData.phoneNumber || null,
        displayName: sessionData.displayName || null,
      });
    }

    // Fallback to sessionId if backend call fails
    console.log("[userid] Backend call failed, using sessionId:", sessionId);
    return NextResponse.json({ userId: sessionId });
  } catch (error) {
    console.error("Error getting user ID:", error);
    // Fallback to sessionId on error
    return NextResponse.json({ userId: sessionId || "unknown" });
  }
}
