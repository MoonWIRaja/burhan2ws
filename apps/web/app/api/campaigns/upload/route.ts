import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://0.0.0.0:3001";

function getSessionId(request: NextRequest): string | null {
  return request.cookies.get("session_id")?.value || null;
}

// Helper to convert file to base64
async function fileToBase64(file: File): Promise<string> {
  const reader = file.stream().getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const byteArray = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
  return Buffer.from(byteArray).toString("base64");
}

// POST /api/campaigns/upload - Upload media file (accepts both FormData and JSON)
export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";

    let fileName: string;
    let fileType: string;
    let base64: string;

    // Handle JSON payload (base64 already encoded)
    if (contentType.includes("application/json")) {
      const body = await request.json();
      fileName = body.fileName;
      fileType = body.fileType;
      base64 = body.base64;

      if (!fileName || !fileType || !base64) {
        return NextResponse.json(
          { error: "Missing required fields: fileName, fileType, base64" },
          { status: 400 }
        );
      }
    }
    // Handle FormData payload (convert to base64)
    else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      fileName = file.name;
      fileType = file.type;
      base64 = await fileToBase64(file);
    }
    else {
      return NextResponse.json(
        { error: "Unsupported content type. Use JSON or FormData." },
        { status: 400 }
      );
    }

    // Send to backend base64 endpoint with 500MB limit
    const response = await fetch(`${API_URL}/api/campaigns/upload-base64`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": sessionId,
        Cookie: `session_id=${sessionId}`,
      },
      credentials: "include",
      body: JSON.stringify({ fileName, fileType, base64 }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Campaigns upload error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
