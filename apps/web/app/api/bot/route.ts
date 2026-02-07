import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:3001";

// Helper to get session ID from cookie
function getSessionId(request: NextRequest): string {
  return request.cookies.get("session_id")?.value || "";
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    const response = await fetch(`${API_URL}/api/bot/status`, {
      headers: {
        "x-user-id": sessionId,
        "Cookie": `session_id=${sessionId}`,
      },
    }).catch(() => null);

    if (response && response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    }

    // Return default status if bot API is not available
    return NextResponse.json(
      { isEnabled: false, status: "stopped", botMode: "normal", config: null },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { isEnabled: false, status: "stopped", botMode: "normal", config: null },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = getSessionId(request);

    const response = await fetch(`${API_URL}/api/bot/toggle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": sessionId,
        "Cookie": `session_id=${sessionId}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to control bot" }, { status: 500 });
  }
}
