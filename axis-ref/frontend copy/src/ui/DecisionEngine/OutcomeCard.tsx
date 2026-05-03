import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BreakdownItem,
  ExplanationPayload,
  ExplanationRow,
  ExplanationSource,
  Outcome,
} from "@/types/decision";
import type { RegionIntel } from "@/types/intel";
import type { PlayerTeam } from "@/state/playerTeam";
import { loadExplanation } from "@/api/loadExplanation";

interface Props {
  outcome: Outcome;
  /** Enable click-to-expand rows in the immersive workspace. */
  expandable?: boolean;
  /** Required when `expandable` is true: the live region intel + team. */
  region?: RegionIntel | null;
  team?: PlayerTeam;
  actionId?: string;
  /** Sizing variant. "compact" for the docked side panel (default),
   *  "comfortable" for the immersive full-screen workspace. */
  size?: "compact" | "comfortable";
}

function probTone(p: number): string {
  if (p >= 0.7) return "var(--accent-ok)";
  if (p >= 0.45) return "var(--ink-50)";
  if (p >= 0.25) return "var(--accent-amber)";
  return "var(--accent-danger)";
}

function isPoliticalItem(item: BreakdownItem): boolean {
  return item.source === "pressure" || item.source === "credibility";
}

function rowKey(item: BreakdownItem, idx: number): string {
  return item.key ?? `${item.kind}:${item.label}:${idx}`;
}

export function OutcomeCard({
  outcome,
  expandable = false,
  region,
  team,
  actionId,
  size = "compact",
}: Props) {
  const pct = Math.round(outcome.probability * 100);
  const color = probTone(outcome.probability);

  const roomy = size === "comfortable";

  const baseAndIntel = outcome.breakdown.filter((b) => !isPoliticalItem(b));
  const political = outcome.breakdown.filter(isPoliticalItem);

  // Expansion state: which row key is expanded (null = none).
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Cached explanation payload for the current (action, region, team).
  const [explanation, setExplanation] = useState<ExplanationPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheKeyRef = useRef<string | null>(null);

  const cacheKey = useMemo(() => {
    if (!expandable || !actionId || !team || !region) return null;
    return `${actionId}::${region.region_id}::${team}`;
  }, [expandable, actionId, team, region]);

  const canFetch = expandable && actionId != null && team != null && region != null;

  // Reset expansion / cache on (action, region, team) change.
  useEffect(() => {
    setExpandedKey(null);
    if (cacheKey !== cacheKeyRef.current) {
      cacheKeyRef.current = cacheKey;
      setExplanation(null);
      setError(null);
    }
  }, [cacheKey]);

  const fetchExplanation = async () => {
    if (!canFetch || !actionId || !team || !region) return;
    if (explanation) return;
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await loadExplanation({ actionId, team, region });
      setExplanation(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const onRowClick = (key: string) => {
    if (!expandable) return;
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    void fetchExplanation();
  };

  const explanationByKey = useMemo(() => {
    const map = new Map<string, ExplanationRow>();
    if (explanation) {
      for (const row of explanation.rows) map.set(row.key, row);
    }
    return map;
  }, [explanation]);

  const containerCls = roomy ? "hairline-t px-5 py-5" : "hairline-t px-4 py-3";
  const successHeaderCls = roomy
    ? "font-mono text-[14px] font-semibold uppercase tracking-wider2 text-ink-100"
    : "font-mono text-[10px] uppercase tracking-wider2 text-ink-200";
  const pctCls = roomy
    ? "font-mono text-[44px] font-semibold leading-none"
    : "font-mono text-[28px] leading-none";
  const helperCls = roomy
    ? "mt-2 font-mono text-[12px] font-medium normal-case text-ink-200"
    : "mt-1 font-mono text-[9px] normal-case text-ink-300";
  const groupHeaderCls = roomy
    ? "mb-1.5 font-mono text-[12px] font-semibold uppercase tracking-wider2 text-ink-200"
    : "mb-0.5 font-mono text-[9px] uppercase tracking-wider2 text-ink-300";
  const groupHeaderPolCls = roomy
    ? "mb-1.5 font-mono text-[12px] font-semibold uppercase tracking-wider2 text-accent-amber/90"
    : "mb-0.5 font-mono text-[9px] uppercase tracking-wider2 text-accent-amber/90";
  const explanationCls = roomy
    ? "mt-4 border-l-2 border-ink-400 pl-3 text-[15px] font-medium leading-snug text-ink-50"
    : "mt-3 border-l-2 border-ink-400 pl-3 text-[12px] leading-snug text-ink-100";

  return (
    <div className={containerCls}>
      <div className="flex items-baseline justify-between">
        <span className={successHeaderCls}>
          estimated success
        </span>
        <span className={pctCls} style={{ color }}>
          {pct}%
        </span>
      </div>
      {expandable && (
        <div className={helperCls}>
          click any row for the full why, sources, and political layer
        </div>
      )}

      <div className={roomy ? "mt-3 flex flex-col gap-3" : "mt-2 flex flex-col gap-2"}>
        <div>
          <div className={groupHeaderCls}>
            base + local intel
          </div>
          <div className={roomy ? "flex flex-col gap-1.5" : "flex flex-col gap-1"}>
            {baseAndIntel.map((item, idx) => {
              const key = rowKey(item, idx);
              return (
                <BreakdownRow
                  key={`intel-${key}`}
                  item={item}
                  variant="default"
                  expandable={expandable}
                  expanded={expandedKey === key}
                  onClick={() => onRowClick(key)}
                  detail={explanationByKey.get(key)}
                  loading={loading && expandedKey === key && !explanation}
                  error={error && expandedKey === key ? error : null}
                  size={size}
                />
              );
            })}
          </div>
        </div>
        {political.length > 0 && (
          <div className={`rounded-sm border border-accent-amber/30 bg-ink-900/40 ${roomy ? "p-3" : "p-2"}`}>
            <div className={groupHeaderPolCls}>
              political layer (turn / pressure / credibility)
            </div>
            <div className={roomy ? "flex flex-col gap-1.5" : "flex flex-col gap-1"}>
              {political.map((item, idx) => {
                const key = rowKey(item, idx);
                return (
                  <BreakdownRow
                    key={`pol-${key}`}
                    item={item}
                    variant="political"
                    expandable={expandable}
                    expanded={expandedKey === key}
                    onClick={() => onRowClick(key)}
                    detail={explanationByKey.get(key)}
                    loading={loading && expandedKey === key && !explanation}
                    error={error && expandedKey === key ? error : null}
                    size={size}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className={explanationCls}>
        {outcome.explanation}
      </div>
    </div>
  );
}

interface BreakdownRowProps {
  item: BreakdownItem;
  variant: "default" | "political";
  expandable: boolean;
  expanded: boolean;
  onClick: () => void;
  detail: ExplanationRow | undefined;
  loading: boolean;
  error: string | null;
  size?: "compact" | "comfortable";
}

function BreakdownRow({
  item,
  variant,
  expandable,
  expanded,
  onClick,
  detail,
  loading,
  error,
  size = "compact",
}: BreakdownRowProps) {
  const isBase = item.kind === "base";
  const positive = item.delta >= 0;
  const pct = (Math.abs(item.delta) * 100).toFixed(1);
  const sign = isBase ? "" : positive ? "+" : "−";
  const fillColor = isBase
    ? "var(--ink-300)"
    : positive
      ? "var(--accent-ok)"
      : "var(--accent-danger)";
  const widthPct = Math.min(100, Math.abs(item.delta) * 100 * 1.2);
  const roomy = size === "comfortable";
  const labelTone =
    variant === "political"
      ? roomy ? "text-ink-50" : "text-ink-100"
      : roomy ? "text-ink-100" : "text-ink-200";

  const interactive = expandable;
  const buttonPad = roomy ? "px-2 py-1" : "px-1 py-0.5";
  const labelRowCls = roomy
    ? "flex items-baseline justify-between font-mono text-[13px] font-semibold uppercase tracking-wider2"
    : "flex items-baseline justify-between font-mono text-[10px] uppercase tracking-wider2";
  const detailLineCls = roomy
    ? "mt-1 font-mono text-[11px] font-medium normal-case leading-snug text-ink-200"
    : "mt-0.5 font-mono text-[8px] normal-case leading-tight text-ink-300";
  const barTrackCls = roomy
    ? "mt-1.5 h-[5px] w-full bg-ink-600"
    : "mt-0.5 h-[3px] w-full bg-ink-600";

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={!interactive}
        className={`w-full text-left ${
          interactive
            ? "cursor-pointer transition-colors hover:bg-ink-700/30"
            : "cursor-default"
        } ${expanded ? "bg-ink-700/40" : ""} -mx-1 rounded-sm ${buttonPad}`}
        aria-expanded={interactive ? expanded : undefined}
      >
        <div className={labelRowCls}>
          <span className={labelTone}>
            {interactive ? (
              <span
                className={`${roomy ? "mr-2 w-2.5 text-[14px]" : "mr-1.5 w-2"} inline-block text-ink-300`}
                aria-hidden="true"
              >
                {expanded ? "▾" : "▸"}
              </span>
            ) : null}
            {item.label}
          </span>
          <span className="text-ink-50">
            {sign}
            {pct}%
          </span>
        </div>
        {item.detail && !expanded && (
          <div className={detailLineCls}>
            {item.detail}
          </div>
        )}
        <div className={barTrackCls}>
          <div
            className="h-full"
            style={{ width: `${widthPct}%`, background: fillColor }}
          />
        </div>
      </button>

      {expanded && (
        <ExpandedDetail
          item={item}
          detail={detail}
          loading={loading}
          error={error}
        />
      )}
    </div>
  );
}

function ExpandedDetail({
  item,
  detail,
  loading,
  error,
}: {
  item: BreakdownItem;
  detail: ExplanationRow | undefined;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="hairline-l ml-2 mt-1 border-ink-500/70 bg-ink-900/40 px-3 py-2">
      {loading && !detail && (
        <div className="font-mono text-[10px] text-ink-300">
          loading explanation…
        </div>
      )}
      {error && !detail && (
        <div className="font-mono text-[10px] text-accent-danger">
          {error}
        </div>
      )}
      {detail && <DetailContent detail={detail} />}
      {!loading && !error && !detail && (
        <div className="font-mono text-[10px] text-ink-300">
          {item.detail ?? "No additional explanation available."}
        </div>
      )}
    </div>
  );
}

function DetailContent({ detail }: { detail: ExplanationRow }) {
  const isPolitical = detail.key === "pressure" || detail.key === "credibility";
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] leading-snug text-ink-50">{detail.summary}</p>
      {detail.math && (
        <div className="font-mono text-[10px] text-ink-300">
          <span className="text-ink-400">math · </span>
          {detail.math}
        </div>
      )}
      {detail.disclaimer && (
        <div className="rounded-sm border border-accent-amber/40 bg-accent-amber/5 px-2 py-1 font-mono text-[9px] uppercase tracking-wider2 text-accent-amber">
          {detail.disclaimer}
        </div>
      )}

      {isPolitical && detail.data && <PoliticalData detail={detail} />}

      {detail.sources && detail.sources.length > 0 && (
        <SourcesBlock sources={detail.sources} />
      )}
    </div>
  );
}

function PoliticalData({ detail }: { detail: ExplanationRow }) {
  const data = detail.data;
  if (!data) return null;
  if (detail.key === "pressure") {
    const intensity = data.intensity ?? 0;
    return (
      <div className="rounded-sm border border-accent-amber/30 bg-ink-900/30 p-2 text-[11px] text-ink-100">
        <div className="mb-1 font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
          political pressure detail
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[10px] text-ink-200">
          <span>issuer</span>
          <span className="text-ink-50">
            {data.issuer_faction_name ?? data.issuer_faction_id ?? "—"}
          </span>
          <span>intensity</span>
          <span className="text-ink-50">
            {(intensity * 100).toFixed(0)}%
          </span>
          {data.deadline_remaining != null && (
            <>
              <span>deadline</span>
              <span className="text-ink-50">
                T-{data.deadline_remaining}
                {data.deadline_turn != null
                  ? ` (turn ${data.deadline_turn})`
                  : ""}
              </span>
            </>
          )}
          <span>aggression bias</span>
          <span className="text-ink-50">
            {data.aggression_bias != null
              ? `${data.aggression_bias >= 0 ? "+" : ""}${data.aggression_bias.toFixed(2)}`
              : "—"}
          </span>
        </div>
        {data.pressure_drivers && data.pressure_drivers.length > 0 && (
          <div className="mt-2">
            <div className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
              drivers
            </div>
            <ul className="mt-0.5 list-disc pl-4 text-[11px] text-ink-100">
              {data.pressure_drivers.map((d, i) => (
                <li key={`d-${i}`}>{d}</li>
              ))}
            </ul>
          </div>
        )}
        {data.wargame_note && (
          <div className="mt-2 border-l-2 border-accent-amber/40 pl-2 text-[10px] italic leading-snug text-ink-200">
            {data.wargame_note}
          </div>
        )}
      </div>
    );
  }
  if (detail.key === "credibility") {
    const imm = data.immediate ?? 0;
    const res = data.resolve ?? 0;
    return (
      <div className="rounded-sm border border-accent-amber/30 bg-ink-900/30 p-2 text-[11px] text-ink-100">
        <div className="mb-1 font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
          credibility detail (
          {data.issuer_faction_name ?? data.issuer_faction_id ?? "issuer"} →{" "}
          {data.target_faction_name ?? data.target_faction_id ?? "target"})
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[10px] text-ink-200">
          <span>immediate (recent)</span>
          <span className="text-ink-50">{formatSigned(imm)}</span>
          <span>resolve (long-range)</span>
          <span className="text-ink-50">{formatSigned(res)}</span>
          <span>credibility weight</span>
          <span className="text-ink-50">
            {data.credibility_weight != null
              ? formatSigned(data.credibility_weight)
              : "—"}
          </span>
        </div>
        {data.gap_history && data.gap_history.length > 0 && (
          <div className="mt-2">
            <div className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
              recent signal vs action gaps
            </div>
            <ul className="mt-0.5 flex flex-col gap-0.5 text-[10px] text-ink-100">
              {data.gap_history.map((h, i) => (
                <li key={`g-${i}`} className="font-mono">
                  <span className="text-ink-300">turn {h.turn} · </span>
                  said {formatSigned(h.signal_severity)} / did{" "}
                  {formatSigned(h.action_severity)}
                  <span className="text-ink-300"> · gap </span>
                  <span
                    className={
                      h.gap >= 0 ? "text-accent-ok" : "text-accent-danger"
                    }
                  >
                    {formatSigned(h.gap)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.recent_signals && data.recent_signals.length > 0 && (
          <div className="mt-2">
            <div className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
              recent leader signals from issuer
            </div>
            <ul className="mt-0.5 flex flex-col gap-1">
              {data.recent_signals.map((s) => (
                <li
                  key={s.id}
                  className="rounded-sm border border-ink-600/60 bg-ink-900/40 px-2 py-1 text-[11px] text-ink-100"
                >
                  <div className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
                    {s.type} · severity {formatSigned(s.severity)} · {s.source}
                    {s.turn != null ? ` · turn ${s.turn}` : ""}
                  </div>
                  <div className="mt-0.5 leading-snug">{s.text}</div>
                  {s.source_url && (
                    <a
                      href={s.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-block font-mono text-[9px] text-faction-nato underline-offset-2 hover:underline"
                    >
                      open source ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.wargame_note && (
          <div className="mt-2 border-l-2 border-accent-amber/40 pl-2 text-[10px] italic leading-snug text-ink-200">
            {data.wargame_note}
          </div>
        )}
      </div>
    );
  }
  return null;
}

function SourcesBlock({ sources }: { sources: ExplanationSource[] }) {
  return (
    <div>
      <div className="mb-0.5 font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
        sources
      </div>
      <ul className="flex flex-col gap-1">
        {sources.map((s, idx) => (
          <li
            key={`src-${idx}`}
            className="rounded-sm border border-ink-600/60 bg-ink-900/40 px-2 py-1"
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0 truncate text-[11px] text-ink-100">
                {s.label}
              </div>
              <span className="shrink-0 font-mono text-[8px] uppercase tracking-wider2 text-ink-400">
                {sourceKindLabel(s.kind)}
              </span>
            </div>
            {s.note && (
              <div className="mt-0.5 font-mono text-[9px] normal-case text-ink-300">
                {s.note}
              </div>
            )}
            {s.snippet && (
              <div className="mt-0.5 text-[10px] italic leading-snug text-ink-200">
                {s.snippet}
              </div>
            )}
            {s.url && (
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-block font-mono text-[9px] text-faction-nato underline-offset-2 hover:underline"
              >
                open source ↗
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatSigned(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

function sourceKindLabel(kind: ExplanationSource["kind"]): string {
  switch (kind) {
    case "intel_event":
      return "intel event";
    case "leader_signal":
      return "leader signal";
    case "action_catalog":
      return "action catalog";
    case "scenario_assumption":
      return "scenario assumption";
  }
}
