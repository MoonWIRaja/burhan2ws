import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.INTERNAL_API_URL || (process.env.BACKEND_PORT ? `http://127.0.0.1:${process.env.BACKEND_PORT}` : "http://127.0.0.1:3001");

function getSessionId(request: NextRequest): string | null {
  return request.cookies.get("session_id")?.value || null;
}

// GET /api/tags
export async function GET(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(`${API_URL}/api/tags`, {
      credentials: "include",
      headers: {
        Cookie: `session_id=${sessionId}`,
      },
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ tags: [] }, { status: 500 });
  }
}

// POST /api/tags
export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${API_URL}/api/tags`, {
      credentials: "include",
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
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
  }
}

// DELETE /api/tags (for bulk delete if needed)
export async function DELETE(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No tag IDs provided" }, { status: 400 });
    }

    // Delete each tag
    const results = await Promise.all(
      ids.map((id: string) =>
        fetch(`${API_URL}/api/tags/${id}`, {
          credentials: "include",
          method: "DELETE",
          headers: {
            Cookie: `session_id=${sessionId}`,
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete tags" }, { status: 500 });
  }
}
