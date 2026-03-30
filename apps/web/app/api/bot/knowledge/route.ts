import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.INTERNAL_API_URL || (process.env.BACKEND_PORT ? `http://127.0.0.1:${process.env.BACKEND_PORT}` : "http://127.0.0.1:3001");

function getSessionId(request: NextRequest): string | null {
  return request.cookies.get("session_id")?.value || null;
}

// GET /api/bot/knowledge
export async function GET(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(`${API_URL}/api/bot/knowledge`, {
      headers: {
        Cookie: `session_id=${sessionId}`,
      },
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Bot knowledge GET error:", error);
    return NextResponse.json([], { status: 500 });
  }
}

// POST /api/bot/knowledge - Upload file
export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();

    const response = await fetch(`${API_URL}/api/bot/knowledge`, {
      method: "POST",
      headers: {
        Cookie: `session_id=${sessionId}`,
      },
      body: formData,
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Bot knowledge POST error:", error);
    return NextResponse.json({ error: "Failed to upload knowledge file" }, { status: 500 });
  }
}

// DELETE /api/bot/knowledge
export async function DELETE(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${API_URL}/api/bot/knowledge/${body.fileId}`, {
      method: "DELETE",
      headers: {
        Cookie: `session_id=${sessionId}`,
      },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Bot knowledge DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete knowledge file" }, { status: 500 });
  }
}
