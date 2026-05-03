import type { IntelEvent, RegionIntel } from "@/types/intel";
import type { Faction } from "@/types/scenario";
import { useAppStore } from "@/state/store";
import { Sparkline } from "./Sparkline";

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function SourceLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 border border-ink-400 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider2 text-ink-100 transition-colors hover:border-ink-200 hover:text-ink-50"
    >
      <span aria-hidden="true">↗</span>
      <span className="max-w-[14ch] truncate">{hostname(url)}</span>
    </a>
  );
}

interface Props {
  region: RegionIntel;
  /** Oblast or territory display name. */
  regionLabel: string;
  faction: Faction;
}

const TREND_GLYPH = { rising: "▲", steady: "—", declining: "▼" } as const;
const TREND_TEXT = { rising: "rising", steady: "steady", declining: "declining" } as const;

function moraleTone(score: number): { color: string; label: string } {
  if (score >= 70) return { color: "var(--accent-ok)", label: "high" };
  if (score >= 50) return { color: "var(--ink-50)", label: "moderate" };
  if (score >= 30) return { color: "var(--accent-amber)", label: "weak" };
  return { color: "var(--accent-danger)", label: "critical" };
}

function formatTimeAgo(iso: string, now: number): string {
  const ts = new Date(iso).getTime();
  const diffMin = Math.max(0, Math.round((now - ts) / 60_000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const hours = Math.round(diffMin / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

const CATEGORY_LABEL: Record<string, string> = {
  protest: "Protests",
  military_loss: "Military",
  economic_stress: "Economic",
  political_instability: "Politics",
  nationalist_sentiment: "Nationalism",
};

export function RegionSummary({ region, regionLabel, faction }: Props) {
  const tone = moraleTone(region.morale_score);
  const score = Math.round(region.morale_score);
  const trendSign = region.trend_delta >= 0 ? "+" : "";
  const now = Date.now();
  const openArticle = useAppStore((s) => s.openArticle);
  // Drivers only carry an event_id; resolve URLs by looking the event up in
  // the region's recent_events list so the "source" affordance is consistent
  // across both panels.
  const eventsById = new Map<string, IntelEvent>(
    region.recent_events.map((e) => [e.id, e]),
  );

  return (
    <div className="flex flex-col">
      <div className="hairline-b px-4 pb-3 pt-4">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
          <span>region morale</span>
          <span style={{ color: faction.color }}>{faction.name}</span>
        </div>
        <div className="mt-1 text-base font-semibold text-ink-50">
          {regionLabel}
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <div
              className="font-mono text-[44px] leading-none"
              style={{ color: tone.color }}
            >
              {score}
              <span className="ml-1 text-[14px] text-ink-200">/100</span>
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
              {tone.label} · {TREND_TEXT[region.morale_trend]} (
              {trendSign}
              {region.trend_delta.toFixed(1)})
            </div>
          </div>
          <div
            className="flex flex-col items-end"
            style={{ color: tone.color }}
          >
            <span className="font-mono text-base leading-none">
              {TREND_GLYPH[region.morale_trend]}
            </span>
            <Sparkline values={region.history} stroke={tone.color} />
          </div>
        </div>
      </div>

      <div className="hairline-b px-4 py-3">
        <div className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
          why
        </div>
        {region.drivers.length === 0 ? (
          <div className="mt-2 font-mono text-[11px] text-ink-200">
            No significant signals in window.
          </div>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {region.drivers.map((d) => {
              const isNeg = d.contribution < 0;
              const driverUrl = eventsById.get(d.event_id)?.url;
              return (
                <li key={d.event_id} className="flex items-start gap-2">
                  <span
                    className="mt-1 inline-block h-2 w-2 shrink-0"
                    style={{
                      background: isNeg
                        ? "var(--accent-danger)"
                        : "var(--accent-ok)",
                    }}
                  />
                  <div className="flex-1 leading-snug">
                    <div className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
                      {CATEGORY_LABEL[d.category] ?? d.category} ·{" "}
                      <span style={{ color: isNeg ? "var(--accent-danger)" : "var(--accent-ok)" }}>
                        {isNeg ? "" : "+"}
                        {d.contribution.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[12px] text-ink-50">{d.headline}</div>
                      {driverUrl && <SourceLink url={driverUrl} />}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="hairline-b px-4 py-3">
        <div className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
          recent signal
        </div>
        <ul className="mt-2 flex flex-col gap-2">
          {region.recent_events.slice(0, 3).map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => openArticle(e)}
                className="-mx-1 flex w-full flex-col items-stretch gap-0.5 rounded-sm px-1 py-1 text-left leading-snug transition-colors hover:bg-ink-700/40"
                title="Open article"
              >
                <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider2 text-ink-200">
                  <span>{formatTimeAgo(e.ts, now)}</span>
                  <span className="text-ink-300">·</span>
                  <span>{CATEGORY_LABEL[e.category] ?? e.category}</span>
                  <span className="text-ink-300">·</span>
                  <span className="text-ink-300">{e.source}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[12px] text-ink-50">{e.headline}</div>
                  {e.url && <SourceLink url={e.url} />}
                </div>
                {e.snippet && (
                  <div className="mt-0.5 text-[11px] text-ink-200">{e.snippet}</div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
