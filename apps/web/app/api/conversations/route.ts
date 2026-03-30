import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://127.0.0.1:3001";

function getSessionId(request: NextRequest): string | null {
  return request.cookies.get("session_id")?.value || null;
}

// GET /api/conversations - List conversations
export async function GET(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    const response = await fetch(`${API_URL}/api/conversations${queryString ? `?${queryString}` : ""}`, {
      headers: {
        "x-user-id": sessionId,
        Cookie: `session_id=${sessionId}`,
      },
    });
    const data = await response.json();

    // Transform lastMessagePreview to lastMessage for frontend compatibility
    const transformConversation = (conv: any) => ({
      ...conv,
      lastMessage: conv.lastMessagePreview || conv.lastMessage || null,
    });

    if (Array.isArray(data)) {
      return NextResponse.json(data.map(transformConversation));
    } else if (data && typeof data === "object") {
      return NextResponse.json(transformConversation(data));
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Conversations GET error:", error);
    return NextResponse.json([], { status: 500 });
  }
}

// POST /api/conversations - Create a new conversation
export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${API_URL}/api/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": sessionId,
        Cookie: `session_id=${sessionId}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    // Transform lastMessagePreview to lastMessage for frontend compatibility
    if (data && typeof data === "object") {
      const transformed = {
        ...data,
        lastMessage: data.lastMessagePreview || data.lastMessage || null,
      };
      return NextResponse.json(transformed, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Conversations POST error:", error);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
