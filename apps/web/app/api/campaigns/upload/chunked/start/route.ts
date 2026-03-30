import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:3001";

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("session_id")?.value;
    const body = await request.text();

    const response = await fetch(`${API_URL}/api/campaigns/upload/chunked/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionId && { "x-session-id": sessionId }),
        Cookie: sessionId ? `session_id=${sessionId}` : "",
      },
      body,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[ChunkedUploadProxy] Start error:", error);
    return NextResponse.json(
      { error: "Failed to start upload" },
      { status: 502 }
    );
  }
}
