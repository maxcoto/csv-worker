import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPTS_DIR = join(process.cwd(), "content", "prompts");

const EVENTS_DIR = join(PROMPTS_DIR, "events");
const EVALUATION_DIR = join(PROMPTS_DIR, "evaluation");

export interface PromptMeta {
  id: string;
  name: string;
}

function listPromptsInDir(dir: string, prefix: string): PromptMeta[] {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => {
        const baseId = e.name.replace(/\.md$/i, "");
        const id = prefix ? `${prefix}/${baseId}` : baseId;
        const name = baseId
          .replace(/[-_]+/g, " ")
          .replace(/^\w/, (c) => c.toUpperCase());
        return { id, name };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

/**
 * List event prompts from content/prompts/events/*.md.
 * id format: "events/ExpansionEventsV2" for getPromptContent().
 */
export function listEventPrompts(): PromptMeta[] {
  return listPromptsInDir(EVENTS_DIR, "events");
}

/**
 * List evaluation prompts from content/prompts/evaluation/*.md.
 * id format: "evaluation/ExpansionEvaluationV2" for getPromptContent().
 */
export function listEvaluationPrompts(): PromptMeta[] {
  return listPromptsInDir(EVALUATION_DIR, "evaluation");
}

/**
 * List all .md files in content/prompts (root only). id = filename without extension.
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
 * Read a single prompt file. promptId can be:
 * - composite: "events/ExpansionEventsV2" or "evaluation/ExpansionEvaluationV2" (resolved under content/prompts/)
 * - legacy: "ExpansionEventsV2" (try content/prompts/ExpansionEventsV2.md, then events/, then evaluation/)
 */
export function getPromptContent(promptId: string): string | null {
  const trimmed = promptId.trim();
  if (!trimmed) {
    return null;
  }
  // Composite id: exactly one slash, prefix must be events or evaluation
  if (trimmed.includes("/")) {
    const [prefix, ...rest] = trimmed.split("/");
    const suffix = rest.join("/");
    if (
      (prefix === "events" || prefix === "evaluation") &&
      suffix.length > 0 &&
      !suffix.includes("/") &&
      /^[a-zA-Z0-9_-]+$/.test(suffix)
    ) {
      const fullPath = join(PROMPTS_DIR, `${trimmed}.md`);
      try {
        return readFileSync(fullPath, "utf-8");
      } catch {
        return null;
      }
    }
    return null;
  }
  // Legacy: no slash - try root, then events/, then evaluation/
  const safeId = trimmed.replace(/[^a-zA-Z0-9-_]/g, "");
  if (safeId !== trimmed) {
    return null;
  }
  const rootPath = join(PROMPTS_DIR, `${trimmed}.md`);
  if (existsSync(rootPath)) {
    try {
      return readFileSync(rootPath, "utf-8");
    } catch {
      // fall through
    }
  }
  const eventsPath = join(EVENTS_DIR, `${trimmed}.md`);
  if (existsSync(eventsPath)) {
    try {
      return readFileSync(eventsPath, "utf-8");
    } catch {
      // fall through
    }
  }
  const evaluationPath = join(EVALUATION_DIR, `${trimmed}.md`);
  if (existsSync(evaluationPath)) {
    try {
      return readFileSync(evaluationPath, "utf-8");
    } catch {
      // fall through
    }
  }
  return null;
}
