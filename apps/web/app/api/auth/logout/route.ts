import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://0.0.0.0:3001";

export async function POST(request: NextRequest) {
  try {
    // Get session ID from cookie
    const sessionId = request.cookies.get("session_id")?.value;
    
    const response = await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: {
        ...(sessionId && { "x-session-id": sessionId }),
        Cookie: sessionId ? `session_id=${sessionId}` : "",
      },
    });
    const data = await response.json();
    
    // Clear session cookie on logout
    const res = NextResponse.json(data);
    res.cookies.delete("session_id");
    
    return res;
  } catch (error) {
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}
