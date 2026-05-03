import { useEffect, useState } from "react";

export function DecisionStatusBadge({
  intelLoaded,
  intelError,
  lastIntelLoadAt,
  source,
  tickSeq,
}: {
  intelLoaded: boolean;
  intelError: string | null;
  lastIntelLoadAt: number | null;
  source: string | null;
  tickSeq: number | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (intelError) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider2 text-accent-danger">
        offline
      </span>
    );
  }
  if (!intelLoaded) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
        warming up…
      </span>
    );
  }
  const ago = lastIntelLoadAt
    ? Math.max(0, Math.round((now - lastIntelLoadAt) / 1000))
    : 0;
  return (
    <span className="font-mono text-[10px] uppercase tracking-wider2 text-accent-ok">
      live · {source ?? "?"}
      {tickSeq != null && tickSeq > 0 ? ` #${tickSeq}` : ""} · {ago}s
    </span>
  );
}
