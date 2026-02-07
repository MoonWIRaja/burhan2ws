import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;

    // Forward to the Express API (server-side, use API_URL)
    const baseUrl = process.env.API_URL || "http://localhost:3001";
    const cookieHeader = request.headers.get("cookie");

    const res = await fetch(`${baseUrl}/api/campaigns/${campaignId}`, {
      method: "GET",
      headers: {
        Cookie: cookieHeader || "",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch campaign report" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching campaign report:", error);
    return NextResponse.json({ error: "Failed to fetch campaign report" }, { status: 500 });
  }
}
