import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://127.0.0.1:3001";

function getSessionId(request: NextRequest): string | null {
  return request.cookies.get("session_id")?.value || null;
}

// POST /api/campaigns/upload-proxy - Proxy FormData upload to backend
// Uses AbortController for timeout and streams data efficiently
export async function POST(request: NextRequest) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25 * 60 * 1000); // 25 min timeout

  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the FormData from the request
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log(`[Upload-Proxy] Forwarding file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Create new FormData to send to backend
    const backendFormData = new FormData();
    backendFormData.append("file", file);

    // Forward to backend API with timeout
    const response = await fetch(`${API_URL}/api/campaigns/upload`, {
      method: "POST",
      headers: {
        "Cookie": `session_id=${sessionId}`,
      },
      body: backendFormData,
      signal: controller.signal,
      // @ts-ignore - duplex is for streaming
      duplex: "half",
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      console.error("[Upload-Proxy] Backend error:", response.status, data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log("[Upload-Proxy] Upload complete:", data);
    return NextResponse.json(data);

  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      console.error("[Upload-Proxy] Upload timeout (25 min)");
      return NextResponse.json({ error: "Upload timeout - file too large or connection too slow" }, { status: 408 });
    }

    console.error("[Upload-Proxy] Error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
