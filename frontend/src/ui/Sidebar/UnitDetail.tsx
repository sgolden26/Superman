import type { Faction, Unit } from "@/types/scenario";
import { useAppStore } from "@/state/store";
import { isGroundCombatUnit, type GroundMoveMode } from "@/state/groundMove";
import { isFactionControllableByPlayerTeam } from "@/state/playerTeam";
import type { ActionDraftKind, DraftSpec } from "@/state/actionDraft";
import { SectionHeader } from "./primitives/SectionHeader";
import { KeyValueRow } from "./primitives/KeyValueRow";
import { MetricBar } from "./primitives/MetricBar";
import { FactionTag } from "./primitives/FactionTag";
import { CountryBadge } from "./primitives/CountryBadge";
import { ActionDraftPanel } from "./primitives/ActionDraftPanel";
import { ResupplyPicker } from "./primitives/ResupplyPicker";

interface Props {
  unit: Unit;
  faction: Faction;
}

const KIND_LABEL: Record<Unit["kind"], string> = {
  infantry_brigade: "Infantry Brigade",
  armoured_brigade: "Armoured Brigade",
  air_wing: "Air Wing",
  naval_task_group: "Naval Task Group",
};

const MOVE_ACTIONS: { mode: GroundMoveMode; label: string }[] = [
  { mode: "foot", label: "Move by foot" },
  { mode: "vehicle", label: "Move via vehicle" },
];

interface DraftButton {
  kind: ActionDraftKind;
  spec: (unitId: string) => DraftSpec;
  label: string;
  title: string;
}

function draftButtonsFor(unit: Unit): DraftButton[] {
  if (unit.domain === "ground") {
    return [
      {
        kind: "engage",
        spec: (id) => ({ kind: "engage", unitId: id }),
        label: "Engage",
        title: "Direct fire on a detected hostile unit in range",
      },
    ];
  }
  if (unit.domain === "air") {
    return [
      {
        kind: "rebase_air",
        spec: (id) => ({ kind: "rebase_air", unitId: id }),
        label: "Rebase",
        title: "Reposition air wing to a friendly airfield",
      },
      {
        kind: "air_sortie",
        spec: (id) => ({ kind: "air_sortie", unitId: id, mission: "strike" }),
        label: "Strike sortie",
        title: "Strike a target inside the sortie radius",
      },
      {
        kind: "air_sortie",
        spec: (id) => ({ kind: "air_sortie", unitId: id, mission: "sead" }),
        label: "SEAD sortie",
        title: "Suppress enemy air defences",
      },
      {
        kind: "interdict_supply",
        spec: (id) => ({
          kind: "interdict_supply", platformKind: "air_wing", platformId: id,
        }),
        label: "Interdict supply",
        title: "Strike a hostile supply line",
      },
    ];
  }
  return [
    {
      kind: "naval_move",
      spec: (id) => ({ kind: "naval_move", unitId: id }),
      label: "Naval move",
      title: "Sail to a friendly port",
    },
    {
      kind: "naval_strike",
      spec: (id) => ({ kind: "naval_strike", unitId: id }),
      label: "Naval strike",
      title: "Strike a target with shipboard fires",
    },
  ];
}

export function UnitDetail({ unit, faction }: Props) {
  const groundMoveDrafts = useAppStore((s) => s.groundMoveDrafts);
  const startGroundMove = useAppStore((s) => s.startGroundMove);
  const cancelGroundMove = useAppStore((s) => s.cancelGroundMove);
  const stageMoveFromDraft = useAppStore((s) => s.stageMoveFromDraft);
  const stageEntrenchOrder = useAppStore((s) => s.stageEntrenchOrder);
  const startActionDraft = useAppStore((s) => s.startActionDraft);
  const actionDraft = useAppStore((s) => s.actionDraft);
  const playerTeam = useAppStore((s) => s.playerTeam);
  const stagedOrders = useAppStore((s) => s.stagedOrders);

  const draft = groundMoveDrafts[unit.id];
  const playerOwnsUnit = isFactionControllableByPlayerTeam(faction, playerTeam);
  const showGroundMoves = isGroundCombatUnit(unit.domain) && playerOwnsUnit;
  const draftButtons = playerOwnsUnit ? draftButtonsFor(unit) : [];
  const movePicked = unit.domain === "ground";
  const alreadyStagedMove = stagedOrders[playerTeam].some(
    (o) => o.kind === "move" && o.unitId === unit.id,
  );
  const draftBelongsToThisUnit =
    actionDraft &&
    (("attackerId" in actionDraft && actionDraft.attackerId === unit.id) ||
      ("unitId" in actionDraft && (actionDraft as { unitId?: string }).unitId === unit.id));

  return (
    <div className="flex h-full flex-col">
      <div className="hairline-b px-4 pb-3 pt-4">
        <div className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
          unit
          <span className="px-1 text-ink-400">/</span>
          {unit.domain}
          <span className="px-1 text-ink-400">/</span>
          {unit.echelon}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[18px] font-semibold leading-tight tracking-tight text-ink-50">
            {unit.name}
          </span>
          {unit.callsign && (
            <span className="font-mono text-[11px] text-ink-300">/{unit.callsign}</span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <FactionTag faction={faction} />
          <span className="font-mono text-[10px] tracking-wider2 text-ink-300">
            {unit.id}
          </span>
        </div>
      </div>

      <SectionHeader label="classification" />
      <KeyValueRow label="kind" value={KIND_LABEL[unit.kind]} mono={false} />
      <KeyValueRow label="domain" value={unit.domain.toUpperCase()} />
      <KeyValueRow label="echelon" value={unit.echelon.toUpperCase()} />
      <div className="flex items-center justify-between px-4 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
          country
        </span>
        <CountryBadge countryId={unit.country_id ?? null} />
      </div>

      <SectionHeader label="combat power" />
      <MetricBar label="strength" value={unit.strength} />
      <MetricBar label="readiness" value={unit.readiness} />
      <MetricBar label="morale" value={unit.morale} />
      {movePicked && unit.entrenchment > 0 && (
        <MetricBar label="entrenchment" value={unit.entrenchment} />
      )}

      <SectionHeader label="position" />
      <KeyValueRow
        label="lat / lon"
        value={`${unit.position[1].toFixed(3)}°N  ${unit.position[0].toFixed(3)}°E`}
      />

      <SectionHeader label="orders" />
      {!playerOwnsUnit ? (
        <div className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
          · controlled by {faction.allegiance} team · switch sides to issue orders
        </div>
      ) : (
        <div className="px-3 py-2">
          <div className="grid grid-cols-2 gap-1.5">
            {showGroundMoves &&
              MOVE_ACTIONS.map(({ mode, label }) => {
                const active = draft?.mode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => startGroundMove(unit.id, mode)}
                    title={`Plan movement (${mode})`}
                    className={btnClass(active)}
                  >
                    {label}
                  </button>
                );
              })}
            {showGroundMoves && (
              <button
                type="button"
                onClick={() => stageEntrenchOrder(unit.id)}
                title="Improve dug-in defence; reduces incoming damage next batch"
                className={btnClass(false)}
              >
                Entrench
              </button>
            )}
            {draftButtons.map((b) => {
              const active =
                actionDraft?.kind === b.kind &&
                (("attackerId" in actionDraft && actionDraft.attackerId === unit.id) ||
                  ("unitId" in actionDraft &&
                    (actionDraft as { unitId?: string; mission?: string }).unitId === unit.id &&
                    (b.kind !== "air_sortie" ||
                      (actionDraft as { mission?: string }).mission ===
                        (b.spec(unit.id) as { mission?: string }).mission)));
              return (
                <button
                  key={`${b.kind}:${b.label}`}
                  type="button"
                  onClick={() => startActionDraft(b.spec(unit.id))}
                  title={b.title}
                  className={btnClass(!!active)}
                >
                  {b.label}
                </button>
              );
            })}
            <ResupplyPicker side="from_unit" unitId={unit.id} />
          </div>

          {draft && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!draft.destination}
                title={
                  draft.destination
                    ? "Add this move to the orders cart"
                    : "Click the map inside the movement range to set a destination first."
                }
                onClick={() => stageMoveFromDraft(unit.id)}
                className="hairline border border-accent-ok bg-accent-ok/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider2 text-accent-ok transition-colors hover:bg-accent-ok/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent-ok/10"
              >
                {alreadyStagedMove ? "Replace order" : "Add to orders"}
              </button>
              <button
                type="button"
                onClick={() => cancelGroundMove(unit.id)}
                className="hairline border border-accent-danger bg-accent-danger/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider2 text-accent-danger transition-colors hover:bg-accent-danger/20"
              >
                Cancel
              </button>
            </div>
          )}
          {!draft && alreadyStagedMove && (
            <div className="mt-2 font-mono text-[9px] uppercase tracking-wider2 text-accent-amber">
              · order staged · execute from cart
            </div>
          )}
        </div>
      )}

      {draftBelongsToThisUnit && actionDraft && <ActionDraftPanel draft={actionDraft} />}
    </div>
  );
}

function btnClass(active: boolean): string {
  return `border px-2 py-1.5 text-left font-mono text-[10px] uppercase tracking-wider2 transition-colors ${
    active
      ? "border-faction-nato/60 bg-faction-nato/10 text-faction-nato"
      : "border-[var(--hairline)] bg-ink-700/30 text-ink-100 hover:border-[var(--hairline-strong)] hover:bg-ink-700/60 hover:text-ink-50"
  }`;
}
