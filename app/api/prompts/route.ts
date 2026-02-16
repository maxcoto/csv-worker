import { NextResponse } from "next/server";
import { listPrompts } from "@/lib/prompts/load-prompts";

/**
 * GET /api/prompts
 * Returns list of available prompts (from content/prompts/*.md).
 */
export async function GET() {
  try {
    const prompts = listPrompts();
    return NextResponse.json({ prompts });
  } catch (error) {
    console.error("Prompts API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
