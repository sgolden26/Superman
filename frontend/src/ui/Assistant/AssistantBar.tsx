import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore, type AssistantChatEntry } from "@/state/store";
import { ImplicationsCard } from "@/ui/Assistant/ImplicationsCard";

/** Floating C2 assistant: free-form intent in, transcript + tool-call chips
 *  + Implications Card out. The assistant runs a server-side tool-calling
 *  loop and returns directives the FE dispatches into the store.
 *
 *  Bottom-centre, ~720px, hairline-styled. Cmd/Ctrl+Enter submits;
 *  Esc dismisses the transcript.
 */
export function AssistantBar() {
  const submit = useAppStore((s) => s.submitAssistantChat);
  const dismiss = useAppStore((s) => s.dismissAssistantChat);
  const busy = useAppStore((s) => s.assistantBusy);
  const error = useAppStore((s) => s.assistantError);
  const log = useAppStore((s) => s.assistantChatLog);
  const forecast = useAppStore((s) => s.assistantForecast);
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
    } else if (e.key === "Escape" && (log.length > 0 || error || forecast)) {
      e.preventDefault();
      dismiss();
    }
  };

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setText("");
    await submit(trimmed);
  };

  const teamColor =
    playerTeam === "blue" ? "text-faction-nato" : "text-faction-ru";
  const teamBorder =
    playerTeam === "blue" ? "border-faction-nato/60" : "border-faction-ru/60";
  const teamDot =
    playerTeam === "blue" ? "bg-faction-nato" : "bg-faction-ru";

  const placeholder = ready
    ? "Team is ready. Unready to plan more orders."
    : "C2 intent. e.g. 'forecast the implications of pushing two brigades to Kharkiv before staging'.";

  const showTranscript = log.length > 0 || error || forecast;

  return (
    <div className="pointer-events-none absolute bottom-24 left-1/2 z-[70] flex w-[min(720px,90vw)] -translate-x-1/2 flex-col items-stretch gap-2">
      {showTranscript && (
        <Transcript
          log={log}
          error={error}
          forecast={forecast}
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
          c2 assistant
        </span>
        <textarea
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Mission C2 assistant"
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

interface TranscriptProps {
  log: AssistantChatEntry[];
  error: string | null;
  forecast: ReturnType<typeof useAppStore.getState>["assistantForecast"];
  onDismiss: () => void;
}

function Transcript({ log, error, forecast, onDismiss }: TranscriptProps) {
  // Last user prompt + assistant reply + a compressed tool chip strip.
  const { latestUser, latestAssistant, tools } = useMemo(() => {
    let latestUser: AssistantChatEntry | null = null;
    let latestAssistant: AssistantChatEntry | null = null;
    const tools: AssistantChatEntry[] = [];
    for (const entry of log) {
      if (entry.role === "user") {
        latestUser = entry;
        latestAssistant = null;
        tools.length = 0;
      } else if (entry.role === "assistant") {
        latestAssistant = entry;
      } else if (entry.role === "tool") {
        tools.push(entry);
      }
    }
    return { latestUser, latestAssistant, tools };
  }, [log]);

  return (
    <div className="pointer-events-auto flex flex-col gap-2">
      {forecast && <ImplicationsCard forecast={forecast} onDismiss={onDismiss} />}

      <div className="hairline border border-ink-500 bg-ink-800/95 px-3 py-2 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-1.5">
            {error && (
              <p className="font-mono text-[10px] uppercase tracking-wider2 text-accent-danger">
                {error}
              </p>
            )}

            {latestUser && (
              <div className="flex items-start gap-2">
                <span className="mt-[3px] hairline border border-ink-300 bg-ink-700/60 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider2 text-ink-200">
                  you
                </span>
                <p className="text-[12px] leading-snug text-ink-50">
                  {latestUser.content}
                </p>
              </div>
            )}

            {tools.length > 0 && (
              <ul className="flex flex-wrap gap-1">
                {tools.map((t) => (
                  <li
                    key={t.id}
                    className={`hairline border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider2 ${chipClass(
                      t.toolStatus,
                    )}`}
                    title={t.content}
                  >
                    {t.toolName}: {t.content}
                  </li>
                ))}
              </ul>
            )}

            {latestAssistant && (
              <div className="flex items-start gap-2">
                <span className="mt-[3px] hairline border border-accent-ok bg-accent-ok/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider2 text-accent-ok">
                  c2
                </span>
                <p className="text-[12px] leading-snug text-ink-50">
                  {latestAssistant.content}
                </p>
              </div>
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
    </div>
  );
}

function chipClass(status: AssistantChatEntry["toolStatus"]): string {
  switch (status) {
    case "directive":
      return "border-accent-amber/70 bg-accent-amber/10 text-accent-amber";
    case "error":
      return "border-accent-danger/70 bg-accent-danger/10 text-accent-danger";
    default:
      return "border-ink-500 bg-ink-700/60 text-ink-100";
  }
}
