import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.INTERNAL_API_URL || (process.env.BACKEND_PORT ? `http://127.0.0.1:${process.env.BACKEND_PORT}` : "http://127.0.0.1:3001");

function getSessionId(request: NextRequest): string | null {
  return request.cookies.get("session_id")?.value || null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const response = await fetch(`${API_URL}/api/campaigns/${id}/start`, {
      method: "POST",
      headers: {
        "x-user-id": sessionId,
        Cookie: `session_id=${sessionId}`,
      },
      credentials: "include",
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Campaign start error:", error);
    return NextResponse.json({ error: "Failed to start campaign" }, { status: 500 });
  }
}
