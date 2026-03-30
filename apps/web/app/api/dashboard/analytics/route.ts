import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.INTERNAL_API_URL || (process.env.BACKEND_PORT ? `http://127.0.0.1:${process.env.BACKEND_PORT}` : "http://127.0.0.1:3001");

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("session_id")?.value || "";
    const url = new URL(request.url);
    const queryString = url.searchParams.toString();
    const response = await fetch(`${API_URL}/api/dashboard/analytics${queryString ? `?${queryString}` : ""}`, {
      headers: {
        "x-user-id": sessionId,
        Cookie: `session_id=${sessionId}`,
      },
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}
