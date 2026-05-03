import { useEffect } from "react";
import { useAppStore } from "@/state/store";

export function MoveLimitToast() {
  const message = useAppStore((s) => s.moveRadiusToast);
  const dismiss = useAppStore((s) => s.dismissMoveRadiusToast);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(dismiss, 5000);
    return () => window.clearTimeout(id);
  }, [message, dismiss]);

  if (!message) return null;

  return (
    <div
      className="pointer-events-auto absolute bottom-24 left-1/2 z-[80] flex max-w-sm -translate-x-1/2 items-start gap-2 seam border bg-mil-800/95 px-3 py-2 shadow-lg"
      role="status"
    >
      <p className="flex-1 font-mono text-[10px] uppercase tracking-wider2 leading-snug text-mil-100">
        {message}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 seam border border-mil-500 px-1.5 py-0.5 font-mono text-[11px] text-mil-200 transition-colors hover:border-mil-300 hover:text-mil-50"
      >
        ×
      </button>
    </div>
  );
}
