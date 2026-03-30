import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.INTERNAL_API_URL || (process.env.BACKEND_PORT ? `http://127.0.0.1:${process.env.BACKEND_PORT}` : "http://127.0.0.1:3001");

export async function POST(request: NextRequest) {
  try {
    // Get session ID from cookie
    const sessionId = request.cookies.get("session_id")?.value;
    
    const response = await fetch(`${API_URL}/api/auth/connect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
      error: "Failed to connect",
      status: "backend_offline",
      backendUnavailable: true,
    });
  }
}
