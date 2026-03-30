import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://0.0.0.0:3001";

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Backend offline", status: "error", backendUnavailable: true },
      { status: 200 }
    );
  }
}
