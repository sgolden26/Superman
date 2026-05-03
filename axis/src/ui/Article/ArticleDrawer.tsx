import { useEffect, useMemo } from "react";
import { useAppStore } from "@/state/store";
import type { IntelEvent } from "@/types/intel";

const CATEGORY_LABEL: Record<IntelEvent["category"], string> = {
  protest: "Protests",
  military_loss: "Military",
  economic_stress: "Economic",
  political_instability: "Politics",
  nationalist_sentiment: "Nationalism",
};

const CATEGORY_GLYPH: Record<IntelEvent["category"], string> = {
  protest: "✦",
  military_loss: "☠",
  economic_stress: "₿",
  political_instability: "⚠",
  nationalist_sentiment: "✷",
};

const CATEGORY_TONE: Record<IntelEvent["category"], string> = {
  protest: "var(--accent-amber)",
  military_loss: "var(--accent-danger)",
  economic_stress: "var(--accent-amber)",
  political_instability: "var(--accent-amber)",
  nationalist_sentiment: "var(--mil-50)",
};

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
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

function weightTone(weight: number): string {
  if (weight <= -0.4) return "var(--accent-danger)";
  if (weight < 0) return "var(--accent-amber)";
  if (weight > 0) return "var(--accent-ok)";
  return "var(--mil-100)";
}

export function ArticleDrawer() {
  const article = useAppStore((s) => s.selectedArticle);
  const close = useAppStore((s) => s.closeArticle);
  const scenario = useAppStore((s) => s.scenario);

  const regionLabel = useMemo(() => {
    if (!article || !scenario) return article?.region_id ?? "";
    const oblast = scenario.oblasts.find((o) => o.id === article.region_id);
    if (oblast) return oblast.name;
    const territory = scenario.territories.find((t) => t.id === article.region_id);
    if (territory) return territory.name;
    return article.region_id;
  }, [article, scenario]);

  useEffect(() => {
    if (!article) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [article, close]);

  if (!article) return null;

  const tone = CATEGORY_TONE[article.category];
  const sign = article.weight >= 0 ? "+" : "";
  const ts = new Date(article.ts);
  const tsLine = `${ts.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })} · ${formatTimeAgo(article.ts, Date.now())}`;

  return (
    <aside
      className="seam-l deck-surface absolute inset-y-0 right-0 z-[150000] flex w-[380px] flex-col bg-mil-900 shadow-[0_0_30px_rgba(0,0,0,0.5)]"
      role="dialog"
      aria-modal="false"
      aria-label="Article detail"
    >
      <header className="seam-b flex items-center justify-between gap-3 bg-mil-800 px-4 py-2">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-wider2 text-mil-200">
            signal
          </div>
          <div className="truncate font-mono text-[9px] uppercase tracking-wider2 text-mil-300">
            {article.source} · {article.id}
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="shrink-0 border border-mil-500 bg-mil-800 px-2 py-1 font-mono text-[10px] uppercase tracking-wider2 text-mil-200 hover:border-mil-300 hover:text-mil-50"
          title="Close (Esc)"
        >
          ×
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="seam-b px-4 pb-3 pt-3">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider2 text-mil-200">
            <span style={{ color: tone }}>{CATEGORY_GLYPH[article.category]}</span>
            <span>{CATEGORY_LABEL[article.category]}</span>
            <span className="text-mil-300">·</span>
            <span style={{ color: weightTone(article.weight) }}>
              {sign}
              {article.weight.toFixed(2)}
            </span>
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-wider2 text-mil-200">
            {regionLabel}
            <span className="text-mil-300"> · {article.region_id}</span>
          </div>
          <div className="mt-1 font-mono text-[10px] tracking-wider2 text-mil-300">
            {tsLine}
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="text-[15px] font-semibold leading-snug text-mil-50">
            {article.headline}
          </div>
          {article.snippet && (
            <div className="mt-2 text-[12px] leading-snug text-mil-200">
              {article.snippet}
            </div>
          )}
        </div>

        {article.url && (
          <div className="seam-t px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-wider2 text-mil-200">
              source
            </div>
            <div className="mt-1 truncate font-mono text-[11px] text-mil-100">
              {hostname(article.url)}
            </div>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 border border-mil-400 bg-mil-800 px-3 py-2 font-mono text-[11px] uppercase tracking-wider2 text-mil-50 transition-colors hover:border-mil-200"
            >
              <span>Open original</span>
              <span aria-hidden="true">↗</span>
            </a>
            <div className="mt-2 font-mono text-[9px] uppercase tracking-wider2 text-mil-300">
              opens in a new tab; most news sites block in-app embedding.
            </div>
          </div>
        )}
        {!article.url && (
          <div className="seam-t px-4 py-3 font-mono text-[10px] uppercase tracking-wider2 text-mil-300">
            no source link on this signal.
          </div>
        )}
      </div>
    </aside>
  );
}
