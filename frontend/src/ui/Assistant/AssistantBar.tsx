import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/state/store";

/** Floating prompt bar: describe the round in plain English, the LLM stages
 *  matching orders. Bottom-centre, ~720px, hairline-styled.
 *
 *  Disabled while the active team is `roundReady` or while a round is
 *  executing. Cmd/Ctrl+Enter submits; Esc dismisses any rationale strip.
 */
export function AssistantBar() {
  const submit = useAppStore((s) => s.submitAssistantPrompt);
  const dismiss = useAppStore((s) => s.dismissAssistant);
  const busy = useAppStore((s) => s.assistantBusy);
  const rationale = useAppStore((s) => s.assistantRationale);
  const warnings = useAppStore((s) => s.assistantWarnings);
  const error = useAppStore((s) => s.assistantError);
  const stagedCount = useAppStore((s) => s.assistantStagedCount);
  const spawnedCount = useAppStore((s) => s.assistantSpawnedCount);
  const playerTeam = useAppStore((s) => s.playerTeam);
  const ready = useAppStore((s) => s.roundReady[s.playerTeam]);
  const executing = useAppStore((s) => s.executing);
  const scenario = useAppStore((s) => s.scenario);

  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const disabled = busy || ready || executing || !scenario;

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    } else if (e.key === "Escape" && (rationale || error || warnings.length > 0)) {
      e.preventDefault();
      dismiss();
    }
  };

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    await submit(trimmed);
    setText("");
  };

  const teamColor =
    playerTeam === "blue" ? "text-faction-nato" : "text-faction-ru";
  const teamBorder =
    playerTeam === "blue" ? "border-faction-nato/60" : "border-faction-ru/60";
  const teamDot =
    playerTeam === "blue" ? "bg-faction-nato" : "bg-faction-ru";

  const placeholder = ready
    ? "Team is ready. Unready to plan more orders."
    : "Describe your round. e.g. 'push two brigades toward Kharkiv, sortie air against the SAM near Rostov'.";

  return (
    <div className="pointer-events-none absolute bottom-24 left-1/2 z-[70] flex w-[min(720px,90vw)] -translate-x-1/2 flex-col items-stretch gap-2">
      {(rationale || error || warnings.length > 0 || spawnedCount > 0) && (
        <RationaleStrip
          rationale={rationale}
          warnings={warnings}
          error={error}
          stagedCount={stagedCount}
          spawnedCount={spawnedCount}
          onDismiss={dismiss}
        />
      )}

      <div
        className={`pointer-events-auto flex items-end gap-2 hairline border ${teamBorder} bg-ink-800/95 px-3 py-2 shadow-xl`}
      >
        <span
          className={`mb-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${teamDot}`}
          aria-hidden
        />
        <span
          className={`mb-1 shrink-0 font-mono text-[9px] uppercase tracking-wider2 ${teamColor}`}
        >
          assistant
        </span>
        <textarea
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Describe your round"
          className="flex-1 resize-none bg-transparent font-mono text-[12px] leading-tight text-ink-50 placeholder:text-ink-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={disabled || text.trim().length === 0}
          className={`shrink-0 hairline border px-2 py-1 font-mono text-[10px] uppercase tracking-wider2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            busy
              ? "border-ink-300 text-ink-100"
              : "border-accent-ok text-accent-ok hover:bg-accent-ok/10"
          }`}
          title="Send (Cmd/Ctrl + Enter)"
        >
          {busy ? "thinking..." : "send"}
        </button>
      </div>
    </div>
  );
}

interface RationaleStripProps {
  rationale: string | null;
  warnings: string[];
  error: string | null;
  stagedCount: number;
  spawnedCount: number;
  onDismiss: () => void;
}

function RationaleStrip({
  rationale,
  warnings,
  error,
  stagedCount,
  spawnedCount,
  onDismiss,
}: RationaleStripProps) {
  return (
    <div className="pointer-events-auto hairline border border-ink-500 bg-ink-800/95 px-3 py-2 shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          {error && (
            <p className="font-mono text-[10px] uppercase tracking-wider2 text-accent-danger">
              {error}
            </p>
          )}
          {!error && rationale && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="hairline border border-accent-ok bg-accent-ok/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider2 text-accent-ok">
                  AI plan
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider2 text-ink-200">
                  {stagedCount} order{stagedCount === 1 ? "" : "s"} staged
                </span>
                {spawnedCount > 0 && (
                  <span className="hairline border border-accent-amber bg-accent-amber/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider2 text-accent-amber">
                    deployed {spawnedCount} platform{spawnedCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <p className="text-[12px] leading-snug text-ink-50">{rationale}</p>
            </>
          )}
          {!error && !rationale && spawnedCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="hairline border border-accent-amber bg-accent-amber/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider2 text-accent-amber">
                deployed {spawnedCount} platform{spawnedCount === 1 ? "" : "s"}
              </span>
            </div>
          )}
          {!error && !rationale && stagedCount === 0 && warnings.length > 0 && (
            <p className="font-mono text-[10px] uppercase tracking-wider2 text-accent-amber">
              No orders staged
            </p>
          )}
          {warnings.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {warnings.slice(0, 6).map((w, i) => (
                <li
                  key={`${i}-${w.slice(0, 24)}`}
                  className="font-mono text-[9px] uppercase tracking-wider2 text-accent-amber"
                >
                  · {w}
                </li>
              ))}
              {warnings.length > 6 && (
                <li className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
                  · {warnings.length - 6} more...
                </li>
              )}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 hairline border border-ink-500 px-1.5 py-0.5 font-mono text-[11px] text-ink-200 transition-colors hover:border-ink-300 hover:text-ink-50"
        >
          ×
        </button>
      </div>
    </div>
  );
}
