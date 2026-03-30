import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.INTERNAL_API_URL || (process.env.BACKEND_PORT ? `http://127.0.0.1:${process.env.BACKEND_PORT}` : "http://127.0.0.1:3001");

export async function GET(request: NextRequest) {
  try {
    // Get session ID from cookie
    const sessionId = request.cookies.get("session_id")?.value;
    
    const response = await fetch(`${API_URL}/api/auth/status`, {
      headers: {
        ...(sessionId && { "x-session-id": sessionId }),
        Cookie: sessionId ? `session_id=${sessionId}` : "",
      },
    });
    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        {
          connected: false,
          status: "db_unavailable",
          phoneNumber: null,
          displayName: null,
          profilePicUrl: null,
          backendUnavailable: true,
          message: data?.message || "Backend unavailable",
        },
        { status: 200 }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        status: "disconnected",
        phoneNumber: null,
        displayName: null,
        profilePicUrl: null
      },
      { status: 200 }
    );
  }
}
