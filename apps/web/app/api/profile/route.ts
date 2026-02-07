import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:3001";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("session_id")?.value;

    const response = await fetch(`${API_URL}/api/profile`, {
      headers: {
        Cookie: sessionId ? `session_id=${sessionId}` : "",
      },
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({
      phoneNumber: null,
      displayName: null,
      about: null,
      profilePicUrl: null,
      status: "error",
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("session_id")?.value;
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionId ? `session_id=${sessionId}` : "",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
