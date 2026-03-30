import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.INTERNAL_API_URL || (process.env.BACKEND_PORT ? `http://127.0.0.1:${process.env.BACKEND_PORT}` : "http://127.0.0.1:3001");

function getSessionId(request: NextRequest): string | null {
  return request.cookies.get("session_id")?.value || null;
}

// GET /api/conversations/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(`${API_URL}/api/conversations/${id}`, {
      headers: {
        "x-user-id": sessionId,
        Cookie: `session_id=${sessionId}`,
      },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to get conversation" }, { status: 500 });
  }
}

// PATCH /api/conversations/[id] - Update conversation (toggle AI, mark read)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const endpoint = body.action === "ai" ? `${id}/ai` : 
                     body.action === "read" ? `${id}/read` : id;

    const response = await fetch(`${API_URL}/api/conversations/${endpoint}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": sessionId,
        Cookie: `session_id=${sessionId}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}
