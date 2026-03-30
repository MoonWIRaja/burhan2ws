import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.INTERNAL_API_URL || (process.env.BACKEND_PORT ? `http://127.0.0.1:${process.env.BACKEND_PORT}` : "http://127.0.0.1:3001");

// Simple ID generator
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// GET /api/auth/session - Get or create browser session
export async function GET(request: NextRequest) {
  try {
    // Check if we already have a session cookie
    const existingSession = request.cookies.get("session_id")?.value;

    // If we have a session, verify it with backend
    // If not, create a new one locally (faster, avoids backend round-trip)
    let sessionId = existingSession;

    if (!sessionId) {
      // Generate new session ID
      sessionId = generateSessionId();
    }

    // Now verify/fetch session data from backend
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (sessionId) {
      headers.Cookie = `session_id=${sessionId}`;
    }

    // Important: include credentials for CORS
    const response = await fetch(`${API_URL}/api/auth/session`, {
      headers,
      credentials: "include", // Essential for CORS with cookies
    });

    if (!response.ok) {
      const fallbackResponse = NextResponse.json({
        sessionId,
        connected: false,
        backendUnavailable: true,
        error: "Backend unavailable, using local session",
      });

      if (sessionId) {
        const isProduction = process.env.NODE_ENV === "production";
        fallbackResponse.cookies.set("session_id", sessionId, {
          httpOnly: false,
          secure: isProduction,
          sameSite: "lax",
          maxAge: 30 * 24 * 60 * 60,
          path: "/",
        });
      }

      return fallbackResponse;
    }

    const data = await response.json();

    // Create the response with session data
    const nextResponse = NextResponse.json(data);

    // Always ensure the session_id cookie is set on the client
    // Use the sessionId from our local cookie first, then backend response
    const finalSessionId = sessionId || data.sessionId;

    if (finalSessionId) {
      const isProduction = process.env.NODE_ENV === "production";
      nextResponse.cookies.set("session_id", finalSessionId, {
        httpOnly: false, // Allow JavaScript to read
        secure: isProduction,
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
        domain: isProduction ? undefined : undefined, // Let browser handle domain
      });
    }

    return nextResponse;
  } catch (error) {
    console.error("Session error:", error);

    // Even on error, ensure we have a session cookie
    const existingSession = request.cookies.get("session_id")?.value;
    if (!existingSession) {
      // Create fallback session
      const fallbackSession = generateSessionId();
      const nextResponse = NextResponse.json({
        sessionId: fallbackSession,
        connected: false,
        error: "Backend unavailable, using local session",
      });

      const isProduction = process.env.NODE_ENV === "production";
      nextResponse.cookies.set("session_id", fallbackSession, {
        httpOnly: false,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
      });

      return nextResponse;
    }

    return NextResponse.json(
      {
        sessionId: existingSession,
        connected: false,
        backendUnavailable: true,
        error: "Backend unavailable, using existing local session",
      },
      { status: 200 }
    );
  }
}
