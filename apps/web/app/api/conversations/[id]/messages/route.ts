import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://127.0.0.1:3001";

function getSessionId(request: NextRequest): string | null {
  return request.cookies.get("session_id")?.value || null;
}

// GET /api/conversations/[id]/messages
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

    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    const response = await fetch(`${API_URL}/api/conversations/${id}/messages${queryString ? `?${queryString}` : ""}`, {
      headers: {
        "x-user-id": sessionId,
        Cookie: `session_id=${sessionId}`,
      },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ messages: [], pagination: { total: 0 } }, { status: 500 });
  }
}

// POST /api/messages
export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${API_URL}/api/messages`, {
      method: "POST",
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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
