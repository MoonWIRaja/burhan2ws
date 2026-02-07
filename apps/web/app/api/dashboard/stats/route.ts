import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:3001";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("session_id")?.value || "";
    const url = new URL(request.url);
    const queryString = url.searchParams.toString();
    const response = await fetch(`${API_URL}/api/dashboard/stats${queryString ? `?${queryString}` : ""}`, {
      headers: {
        "x-user-id": sessionId,
        Cookie: `session_id=${sessionId}`,
      },
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { totalSent: 0, messagesReceived: 0, aiConfidence: 0, totalContacts: 0 },
      { status: 200 }
    );
  }
}
