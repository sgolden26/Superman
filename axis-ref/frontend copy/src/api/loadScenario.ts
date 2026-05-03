import { scenarioSnapshotSchema, type ScenarioSnapshot } from "@/types/scenario";

const LIVE_URL = "/api/state";
const STATIC_URL = "/state.json";

/** Prefer the live theatre service; fall back to the static export so the
 *  demo still loads when `python -m axis serve` is not running. */
export async function loadScenario(url?: string): Promise<ScenarioSnapshot> {
  if (url) return parseScenario(await fetchJson(url));

  try {
    return parseScenario(await fetchJson(LIVE_URL));
  } catch (err) {
    console.warn(
      `[scenario] live API unavailable (${(err as Error).message}); falling back to ${STATIC_URL}`,
    );
    return parseScenario(await fetchJson(STATIC_URL));
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }
  return res.json();
}

function parseScenario(json: unknown): ScenarioSnapshot {
  const parsed = scenarioSnapshotSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[scenario] schema validation failed", parsed.error.issues);
    throw new Error(
      "Scenario JSON failed schema validation. See console for details.",
    );
  }
  return parsed.data;
}
