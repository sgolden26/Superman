import type { ImplicationsForecastDTO } from "@/api/assistantChat";

/** Render a Mission C2 implications forecast: severity bars, credibility
 *  deltas, pressure deltas, and a list of human-readable factors.
 *
 *  Pure presentation; the assistant chat slice owns the data.
 */
export function ImplicationsCard({
  forecast,
  onDismiss,
}: {
  forecast: ImplicationsForecastDTO;
  onDismiss: () => void;
}) {
  const { signal_severity, action_severity, gap, credibility, pressure, factors } =
    forecast;

  return (
    <div className="pointer-events-auto hairline border border-accent-amber/70 bg-ink-800/95 px-3 py-2 shadow-xl">
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="hairline border border-accent-amber bg-accent-amber/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider2 text-accent-amber">
            implications forecast
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider2 text-ink-200">
            issuer {forecast.issuer_team}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss forecast"
          className="shrink-0 hairline border border-ink-500 px-1.5 py-0.5 font-mono text-[11px] text-ink-200 transition-colors hover:border-ink-300 hover:text-ink-50"
        >
          ×
        </button>
      </header>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <Bar label="signal" value={signal_severity} />
        <Bar label="action" value={action_severity} />
        <Bar label="gap" value={gap} highlight />
      </div>

      {credibility.length > 0 && (
        <section className="mt-2">
          <h4 className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
            credibility
          </h4>
          <ul className="mt-1 space-y-0.5">
            {credibility.map((c) => (
              <li
                key={`${c.from_faction_id}->${c.to_faction_id}`}
                className="flex items-center justify-between gap-2 font-mono text-[10px] text-ink-100"
              >
                <span className="text-ink-200">
                  {c.from_faction_id} → {c.to_faction_id}
                </span>
                <span className={deltaClass(c.immediate_delta)}>
                  imm {fmtSigned(c.immediate_delta)}
                </span>
                <span className={deltaClass(c.resolve_delta)}>
                  res {fmtSigned(c.resolve_delta)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pressure.length > 0 && (
        <section className="mt-2">
          <h4 className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
            pressure
          </h4>
          <ul className="mt-1 space-y-0.5">
            {pressure.map((p) => (
              <li
                key={p.faction_id}
                className="flex items-center justify-between gap-2 font-mono text-[10px] text-ink-100"
              >
                <span className="text-ink-200">{p.faction_id}</span>
                <span>{p.intensity_before.toFixed(2)} → {p.intensity_after.toFixed(2)}</span>
                <span className={deltaClass(p.delta)}>{fmtSigned(p.delta)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {factors.length > 0 && (
        <section className="mt-2">
          <h4 className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
            why
          </h4>
          <ul className="mt-1 space-y-1">
            {factors.map((f, i) => (
              <li
                key={`${i}-${f.label}`}
                className={`hairline border px-1.5 py-1 ${factorBorder(f.severity)}`}
              >
                <p
                  className={`font-mono text-[9px] uppercase tracking-wider2 ${factorAccent(f.severity)}`}
                >
                  {f.label}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-ink-50">
                  {f.detail}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Bar({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  const clamped = Math.max(-1, Math.min(1, value));
  const widthPct = Math.abs(clamped) * 50;
  const left = clamped < 0 ? `${50 - widthPct}%` : "50%";
  const colour = clamped >= 0 ? "bg-accent-ok" : "bg-accent-danger";
  return (
    <div className="hairline border border-ink-500 px-1.5 py-1">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[8px] uppercase tracking-wider2 text-ink-300">
          {label}
        </span>
        <span
          className={`font-mono text-[10px] ${
            highlight ? "text-accent-amber" : "text-ink-100"
          }`}
        >
          {fmtSigned(clamped)}
        </span>
      </div>
      <div className="relative mt-1 h-1 w-full bg-ink-700">
        <div className="absolute top-0 h-full w-px bg-ink-400" style={{ left: "50%" }} />
        <div
          className={`absolute top-0 h-full ${colour}`}
          style={{ left, width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

function fmtSigned(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

function deltaClass(delta: number): string {
  if (delta > 0.04) return "text-accent-ok";
  if (delta < -0.04) return "text-accent-danger";
  return "text-ink-200";
}

function factorBorder(sev: "info" | "warn" | "danger"): string {
  switch (sev) {
    case "danger":
      return "border-accent-danger/70 bg-accent-danger/5";
    case "warn":
      return "border-accent-amber/70 bg-accent-amber/5";
    default:
      return "border-ink-500";
  }
}

function factorAccent(sev: "info" | "warn" | "danger"): string {
  switch (sev) {
    case "danger":
      return "text-accent-danger";
    case "warn":
      return "text-accent-amber";
    default:
      return "text-ink-200";
  }
}
