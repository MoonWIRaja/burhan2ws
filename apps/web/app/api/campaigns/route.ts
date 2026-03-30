import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.INTERNAL_API_URL || (process.env.BACKEND_PORT ? `http://127.0.0.1:${process.env.BACKEND_PORT}` : "http://127.0.0.1:3001");

function getSessionId(request: NextRequest): string | null {
  return request.cookies.get("session_id")?.value || null;
}

// GET /api/campaigns - List campaigns
export async function GET(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    const response = await fetch(`${API_URL}/api/campaigns${queryString ? `?${queryString}` : ""}`, {
      headers: {
        "x-user-id": sessionId,
        Cookie: `session_id=${sessionId}`,
      },
      credentials: "include",
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Campaigns GET error:", error);
    return NextResponse.json({ campaigns: [], pagination: { total: 0 } }, { status: 500 });
  }
}

// POST /api/campaigns - Create campaign
export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${API_URL}/api/campaigns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": sessionId,
        Cookie: `session_id=${sessionId}`,
      },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Campaigns POST error:", error);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
