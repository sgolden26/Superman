import { useState } from "react";
import {
  designScenario,
  type CredibilityProfile,
  type DesignScenarioResponse,
  type PressureProfile,
  type ThirdPartyIntensity,
} from "@/api/designScenario";

const PRESSURE_OPTIONS: { value: PressureProfile; label: string }[] = [
  { value: "stable", label: "stable" },
  { value: "elevated", label: "elevated" },
  { value: "acute", label: "acute" },
];

const CREDIBILITY_OPTIONS: { value: CredibilityProfile; label: string }[] = [
  { value: "low_trust", label: "low trust" },
  { value: "fractious", label: "fractious" },
  { value: "cooperative_west", label: "cooperative west" },
];

const THIRD_PARTY_OPTIONS: { value: ThirdPartyIntensity; label: string }[] = [
  { value: "background", label: "background" },
  { value: "active", label: "active" },
  { value: "intervening", label: "intervening" },
];

const PLACEHOLDER =
  "Sponsor wants to stress-test the alliance aid pipeline as the next US tranche slips into a deadline window, with Russian deep-strike pressure on Ukrainian energy infrastructure rising and a mediation track in Riyadh fading. Focus on how blue prioritises scarce air defence and ammunition.";

export function PromptPanel() {
  const [problem, setProblem] = useState("");
  const [pressure, setPressure] = useState<PressureProfile>("elevated");
  const [credibility, setCredibility] =
    useState<CredibilityProfile>("fractious");
  const [thirdParty, setThirdParty] = useState<ThirdPartyIntensity>("active");
  const [deadline, setDeadline] = useState<number>(8);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DesignScenarioResponse | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);

  const canSubmit = problem.trim().length >= 12 && !loading;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await designScenario({
        sponsor_problem_statement: problem.trim(),
        knobs: {
          starting_pressure_profile: pressure,
          starting_credibility_profile: credibility,
          third_party_intensity: thirdParty,
          global_deadline_turn: deadline,
        },
      });
      setResult(res);
      setGeneratedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const onClear = () => {
    setResult(null);
    setError(null);
    setGeneratedAt(null);
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-ink-800">
      <div className="hairline-b flex shrink-0 items-center justify-between px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
          scenario designer
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
          {result?.model
            ? `model · ${result.model}`
            : "openai · initial mode"}
        </span>
      </div>

      <div className="h-0 min-h-0 flex-1 overflow-y-auto">
        <form
          className="hairline-b flex flex-col gap-3 bg-ink-800 px-4 py-3"
          onSubmit={onSubmit}
        >
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
              sponsor problem statement
            </span>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={5}
              className="hairline w-full resize-y rounded-none border bg-ink-900 px-2 py-1.5 font-mono text-[11px] leading-snug text-ink-50 outline-none placeholder:text-ink-300 focus:border-accent-amber"
            />
            <span className="font-mono text-[9px] text-ink-300">
              free text, 1 to 3 sentences. drives the brief and political seed.
            </span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <KnobSelect
              label="pressure profile"
              value={pressure}
              onChange={(v) => setPressure(v as PressureProfile)}
              options={PRESSURE_OPTIONS}
            />
            <KnobSelect
              label="credibility profile"
              value={credibility}
              onChange={(v) => setCredibility(v as CredibilityProfile)}
              options={CREDIBILITY_OPTIONS}
            />
            <KnobSelect
              label="third party intensity"
              value={thirdParty}
              onChange={(v) => setThirdParty(v as ThirdPartyIntensity)}
              options={THIRD_PARTY_OPTIONS}
            />
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-wider2 text-ink-200">
                deadline turn
              </span>
              <input
                type="number"
                min={3}
                max={24}
                value={deadline}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next))
                    setDeadline(Math.max(3, Math.min(24, next)));
                }}
                className="hairline w-full rounded-none border bg-ink-900 px-2 py-1 font-mono text-[11px] text-ink-50 outline-none focus:border-accent-amber"
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="hairline border bg-ink-900 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider2 text-ink-50 hover:border-accent-amber disabled:opacity-40 disabled:hover:border-ink-500"
            >
              {loading ? "generating…" : "generate scenario"}
            </button>
            {(result || error) && (
              <button
                type="button"
                onClick={onClear}
                className="hairline border bg-ink-800 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider2 text-ink-200 hover:text-ink-50"
              >
                clear
              </button>
            )}
            {generatedAt && !loading && (
              <span className="ml-auto font-mono text-[9px] text-ink-300">
                generated {new Date(generatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {error && (
            <div className="hairline border border-accent-danger bg-ink-900 px-2 py-1.5 font-mono text-[10px] leading-snug text-accent-danger">
              {error}
            </div>
          )}
        </form>

        {!result && !loading && (
          <div className="px-4 py-6 font-mono text-[10px] leading-relaxed text-ink-300">
            Returns a NATO-handbook design brief plus a political-layer
            scenario seed. Display-only: the live theatre is not modified.
          </div>
        )}

        {result && <ResultView result={result} />}
      </div>
    </div>
  );
}

interface KnobOption {
  value: string;
  label: string;
}

function KnobSelect(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: KnobOption[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-wider2 text-ink-200">
        {props.label}
      </span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="hairline w-full rounded-none border bg-ink-900 px-2 py-1 font-mono text-[11px] text-ink-50 outline-none focus:border-accent-amber"
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ResultView({ result }: { result: DesignScenarioResponse }) {
  const { design_brief: brief, scenario, out_of_scope } = result;
  return (
    <div className="flex flex-col">
      <Section title="design brief">
        <Field label="problem">{brief.problem_statement}</Field>
        <Field label="aim">{brief.aim}</Field>
        <Field label="objectives">
          <ul className="ml-3 list-disc space-y-0.5">
            {brief.objectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </Field>
        {brief.desired_outcomes && (
          <Field label="desired outcomes">{brief.desired_outcomes}</Field>
        )}
        <ListField label="constraints" items={brief.constraints} />
        <ListField label="limitations" items={brief.limitations} />
        <ListField label="assumptions" items={brief.assumptions} />
        {brief.concept_of_analysis && (
          <Field label="concept of analysis">
            <ListBlock
              label="essential questions"
              items={brief.concept_of_analysis.essential_questions}
            />
            <ListBlock
              label="measures"
              items={brief.concept_of_analysis.measures}
            />
            <ListBlock
              label="data collection"
              items={brief.concept_of_analysis.data_collection}
            />
          </Field>
        )}
        {brief.bias_check_notes && (
          <Field label="bias check">{brief.bias_check_notes}</Field>
        )}
        {brief.timeline_and_milestones && (
          <Field label="timeline">{brief.timeline_and_milestones}</Field>
        )}
      </Section>

      <Section title="political seed">
        {scenario.opening_narrative && (
          <Field label="opening narrative">{scenario.opening_narrative}</Field>
        )}

        <DataPair
          left={
            <KeyVal
              label="turn count"
              value={String(scenario.turn_count ?? "—")}
            />
          }
          right={
            <KeyVal
              label="deadline turn"
              value={String(scenario.global_deadline_turn ?? "—")}
            />
          }
        />

        {scenario.contested_oblasts && scenario.contested_oblasts.length > 0 && (
          <Field label="contested oblasts">
            <ChipRow items={scenario.contested_oblasts} />
          </Field>
        )}

        {scenario.faction_pressure && scenario.faction_pressure.length > 0 && (
          <Field label="faction pressure">
            <div className="grid gap-1.5">
              {scenario.faction_pressure.map((fp) => (
                <PressureRow
                  key={fp.faction_id}
                  id={fp.faction_id}
                  intensity={fp.intensity}
                  deadline={fp.deadline_turn ?? null}
                  drivers={fp.drivers}
                />
              ))}
            </div>
          </Field>
        )}

        {scenario.region_pressure && scenario.region_pressure.length > 0 && (
          <Field label="region pressure">
            <div className="grid gap-1.5">
              {scenario.region_pressure.map((rp) => (
                <PressureRow
                  key={rp.region_id}
                  id={rp.region_id}
                  intensity={rp.intensity}
                  drivers={rp.drivers}
                />
              ))}
            </div>
          </Field>
        )}

        {scenario.credibility && scenario.credibility.length > 0 && (
          <Field label="credibility">
            <div className="grid gap-0.5">
              {scenario.credibility.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 font-mono text-[10px] text-ink-100"
                >
                  <span className="text-ink-300">
                    {c.from_faction_id} → {c.to_faction_id}
                  </span>
                  <span className="text-ink-50">
                    imm {fmtSigned(c.immediate)}
                  </span>
                  <span className="text-ink-300">·</span>
                  <span className="text-ink-50">
                    res {fmtSigned(c.resolve)}
                  </span>
                </div>
              ))}
            </div>
          </Field>
        )}

        {scenario.leader_signals && scenario.leader_signals.length > 0 && (
          <Field label="leader signals">
            <div className="grid gap-1.5">
              {scenario.leader_signals.map((s) => (
                <div
                  key={s.id}
                  className="hairline border bg-ink-900/60 px-2 py-1.5"
                >
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
                    <span className="text-ink-50">{s.speaker_faction_id}</span>
                    <span>·</span>
                    <span>{s.type}</span>
                    {s.target_faction_id && (
                      <>
                        <span>→</span>
                        <span className="text-ink-50">
                          {s.target_faction_id}
                        </span>
                      </>
                    )}
                    {s.region_id && (
                      <>
                        <span>·</span>
                        <span>{s.region_id}</span>
                      </>
                    )}
                    <span className="ml-auto text-ink-50">
                      {fmtSigned(s.severity)}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] leading-snug text-ink-100">
                    {s.text}
                  </p>
                </div>
              ))}
            </div>
          </Field>
        )}

        {scenario.victory_conditions && (
          <Field label="victory conditions">
            <div className="grid gap-1">
              {Object.entries(scenario.victory_conditions).map(([k, v]) => (
                <div key={k} className="font-mono text-[10px] text-ink-100">
                  <span className="uppercase text-ink-300">{k}</span>
                  <span className="ml-2">{v}</span>
                </div>
              ))}
            </div>
          </Field>
        )}
      </Section>

      {out_of_scope && out_of_scope.length > 0 && (
        <Section title="out of scope">
          <ul className="ml-3 list-disc space-y-0.5 font-mono text-[10px] text-accent-amber">
            {out_of_scope.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hairline-b bg-ink-800/60 px-4 py-3">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
        {title}
      </div>
      <div className="grid gap-2.5">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-0.5 font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
        {label}
      </div>
      <div className="font-mono text-[10px] leading-snug text-ink-100">
        {children}
      </div>
    </div>
  );
}

function ListField({
  label,
  items,
}: {
  label: string;
  items?: string[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <Field label={label}>
      <ul className="ml-3 list-disc space-y-0.5">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </Field>
  );
}

function ListBlock({
  label,
  items,
}: {
  label: string;
  items?: string[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-1.5">
      <div className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
        {label}
      </div>
      <ul className="ml-3 list-disc space-y-0.5">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function DataPair({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

function KeyVal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
        {label}
      </div>
      <div className="font-mono text-[11px] text-ink-50">{value}</div>
    </div>
  );
}

function ChipRow({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => (
        <span
          key={it}
          className="hairline border bg-ink-900/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider2 text-ink-100"
        >
          {it}
        </span>
      ))}
    </div>
  );
}

function PressureRow(props: {
  id: string;
  intensity: number;
  deadline?: number | null;
  drivers?: string[];
}) {
  const pct = Math.max(0, Math.min(1, props.intensity));
  return (
    <div className="hairline border bg-ink-900/60 px-2 py-1.5">
      <div className="flex items-center gap-2 font-mono text-[10px] text-ink-50">
        <span className="text-ink-100">{props.id}</span>
        <span className="ml-auto font-mono text-[10px] text-ink-50">
          {(pct * 100).toFixed(0)}%
        </span>
        {props.deadline != null && (
          <span className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
            T-{props.deadline}
          </span>
        )}
      </div>
      <div className="mt-1 h-1 w-full bg-ink-700">
        <div
          className="h-full bg-accent-amber"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      {props.drivers && props.drivers.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {props.drivers.map((d, i) => (
            <span
              key={i}
              className="hairline border bg-ink-800 px-1 py-0.5 font-mono text-[9px] text-ink-200"
            >
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtSigned(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}
