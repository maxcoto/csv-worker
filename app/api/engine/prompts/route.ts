import { NextResponse } from "next/server";
import { engineDb } from "@/lib/engine/db/client";
import { prompts } from "@/lib/engine/db/schema";
import {
  listEvaluationPrompts,
  listEventPrompts,
} from "@/lib/prompts/load-prompts";

function toApiPrompt(
  p: { id: string; name: string },
  source: "filesystem"
): {
  id: string;
  name: string;
  slug: string;
  version: string;
  source: "filesystem";
} {
  return {
    id: p.id,
    name: p.name,
    slug: p.id,
    version: "v1",
    source,
  };
}

/** GET: list event and evaluation prompts (filesystem) for expansion engine. */
export async function GET() {
  try {
    const eventPrompts = listEventPrompts().map((p) =>
      toApiPrompt(p, "filesystem")
    );
    const evaluationPrompts = listEvaluationPrompts().map((p) =>
      toApiPrompt(p, "filesystem")
    );
    const dbPrompts = await engineDb
      .select({
        id: prompts.id,
        name: prompts.name,
        slug: prompts.slug,
        version: prompts.version,
      })
      .from(prompts)
      .orderBy(prompts.name);
    const dbEvaluation = dbPrompts.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      version: p.version,
      source: "db" as const,
    }));
    return NextResponse.json({
      eventPrompts,
      evaluationPrompts: [
        ...dbEvaluation,
        ...evaluationPrompts.map((p) => toApiPrompt(p, "filesystem")),
      ],
      prompts: [
        ...dbEvaluation,
        ...evaluationPrompts.map((p) => toApiPrompt(p, "filesystem")),
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list prompts",
      },
      { status: 500 }
    );
  }
}
