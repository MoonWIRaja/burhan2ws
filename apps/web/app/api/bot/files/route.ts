import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://127.0.0.1:3001";

function getSessionId(request: NextRequest): string | null {
  return request.cookies.get("session_id")?.value || null;
}

// GET /api/bot/files - List files
export async function GET(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path") || "/";

    const response = await fetch(`${API_URL}/api/bot/files?path=${encodeURIComponent(path)}`, {
      headers: {
        Cookie: `session_id=${sessionId}`,
      },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json([], { status: 500 });
  }
}

// POST /api/bot/files - Create file or folder
export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const endpoint = body.isDirectory ? "files/folder" : "files/file";

    const response = await fetch(`${API_URL}/api/bot/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionId}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
