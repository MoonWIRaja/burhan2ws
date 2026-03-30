import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://127.0.0.1:3001";

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

    const response = await fetch(`${API_URL}/api/campaigns/${id}/resume`, {
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
    console.error("Campaign resume error:", error);
    return NextResponse.json({ error: "Failed to resume campaign" }, { status: 500 });
  }
}
