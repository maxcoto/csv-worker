/**
 * Layer 1: Deterministic search query builder for external events.
 * No LLM; constant template strings per category.
 */

export type QueryCategory =
  | "exec_hire"
  | "exec_departure"
  | "layoff"
  | "headcount_growth";

export type SearchQuery = {
  query: string;
  category: QueryCategory;
};

const EXEC_HIRE_TEMPLATES = [
  (name: string) => `${name} appointed VP of Learning`,
  (name: string) => `${name} hired Head of Enablement`,
  (name: string) => `${name} Chief Learning Officer`,
  (name: string) => `${name} new VP Enablement`,
];

const EXEC_DEPARTURE_TEMPLATES = [
  (name: string) => `${name} VP of Learning left`,
  (name: string) => `${name} Head of Enablement resigned`,
  (name: string) => `${name} executive departure learning`,
];

const LAYOFF_TEMPLATES = [
  (name: string) => `${name} layoffs`,
  (name: string) => `${name} workforce reduction`,
  (name: string) => `${name} job cuts`,
  (name: string) => `${name} restructuring`,
];

const HEADCOUNT_GROWTH_TEMPLATES = [
  (name: string) => `${name} hiring expansion`,
  (name: string) => `${name} plans to hire`,
  (name: string) => `${name} expanding workforce`,
];

/**
 * Build search queries for a domain/account. Uses accountName for templates;
 * fallback to domain or "company" if accountName is empty.
 */
export function buildSearchQueries(
  domain: string,
  accountName: string
): SearchQuery[] {
  const label = accountName?.trim() || domain || "company";
  const queries: SearchQuery[] = [];
  for (const fn of EXEC_HIRE_TEMPLATES) {
    queries.push({ query: fn(label), category: "exec_hire" });
  }
  for (const fn of EXEC_DEPARTURE_TEMPLATES) {
    queries.push({ query: fn(label), category: "exec_departure" });
  }
  for (const fn of LAYOFF_TEMPLATES) {
    queries.push({ query: fn(label), category: "layoff" });
  }
  for (const fn of HEADCOUNT_GROWTH_TEMPLATES) {
    queries.push({ query: fn(label), category: "headcount_growth" });
  }
  return queries;
}
