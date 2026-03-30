import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://0.0.0.0:3001";

export async function GET(request: NextRequest) {
  try {
    // Get session ID from cookie
    const sessionId = request.cookies.get("session_id")?.value;
    
    const response = await fetch(`${API_URL}/api/auth/qr`, {
      headers: {
        ...(sessionId && { "x-session-id": sessionId }),
        Cookie: sessionId ? `session_id=${sessionId}` : "",
      },
    });
    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({
        status: "db_unavailable",
        qr: null,
        backendUnavailable: true,
        message: data?.message || "Backend unavailable",
      });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({
      status: "backend_offline",
      qr: null,
      backendUnavailable: true,
    }, { status: 200 });
  }
}
