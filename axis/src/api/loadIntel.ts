import { intelSnapshotSchema, type IntelSnapshot } from "@/types/intel";

export async function loadIntel(url = "/intel.json"): Promise<IntelSnapshot> {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }
  const json = await res.json();
  const parsed = intelSnapshotSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[intel] schema validation failed", parsed.error.issues);
    throw new Error(
      "Intel JSON failed schema validation. See console for details.",
    );
  }
  return parsed.data;
}
