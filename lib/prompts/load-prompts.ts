import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPTS_DIR = join(process.cwd(), "content", "prompts");

export interface PromptMeta {
  id: string;
  name: string;
}

/**
 * List all .md files in content/prompts. id = filename without extension, name = humanized id.
 */
export function listPrompts(): PromptMeta[] {
  try {
    const entries = readdirSync(PROMPTS_DIR, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => {
        const id = e.name.replace(/\.md$/i, "");
        const name = id
          .replace(/[-_]+/g, " ")
          .replace(/^\w/, (c) => c.toUpperCase());
        return { id, name };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    return files;
  } catch {
    return [];
  }
}

/**
 * Read a single prompt file by id (filename without .md).
 */
export function getPromptContent(promptId: string): string | null {
  try {
    const safeId = promptId.replace(/[^a-zA-Z0-9-_]/g, "");
    if (safeId !== promptId) return null;
    const path = join(PROMPTS_DIR, `${promptId}.md`);
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}
