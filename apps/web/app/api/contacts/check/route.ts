import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    // Forward to the Express API (server-side, use API_URL)
    const baseUrl = process.env.API_URL || "http://localhost:3001";
    const cookieHeader = request.headers.get("cookie");

    const res = await fetch(`${baseUrl}/api/contacts/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader && { cookie: cookieHeader }),
      },
      body: JSON.stringify({ phoneNumber }),
    });

    const data = await res.json();

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Error checking number:", error);
    return NextResponse.json({ error: "Failed to check number" }, { status: 500 });
  }
}
