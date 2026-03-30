import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://127.0.0.1:3001";

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("session_id")?.value
      || request.headers.get("x-session-id")
      || "";
    const body = await request.arrayBuffer();

    const response = await fetch(`${API_URL}/api/campaigns/upload/chunked/chunk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        ...(sessionId && { "x-session-id": sessionId }),
        ...(sessionId && { Cookie: `session_id=${sessionId}` }),
        "x-upload-id": request.headers.get("x-upload-id") || "",
        "x-chunk-index": request.headers.get("x-chunk-index") || "",
        "x-byte-offset": request.headers.get("x-byte-offset") || "",
      },
      body,
      // @ts-expect-error Next runtime accepts duplex for streamed uploads.
      duplex: "half",
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[ChunkedUploadProxy] Chunk error:", error);
    return NextResponse.json(
      { error: "Failed to upload chunk" },
      { status: 502 }
    );
  }
}
