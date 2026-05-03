import { create } from "zustand";
import type {
  ScenarioSnapshot,
  Selection,
  SelectableKind,
} from "@/types/scenario";
import type { ChoroplethMetric } from "@/types/country";
import type { IntelEvent, IntelSnapshot, RegionIntel } from "@/types/intel";
import type { PlayerTeam } from "@/state/playerTeam";
import type { GroundMoveDraft, GroundMoveMode } from "@/state/groundMove";
import { isGroundCombatUnit, moveRadiusToastMessage } from "@/state/groundMove";
import {
  batchFromStaged,
  emptyTeamMap,
  newOrderId,
  ownerKey,
  type StagedAirSortieOrder,
  type StagedEngageOrder,
  type StagedEntrenchOrder,
  type StagedInterdictSupplyOrder,
  type StagedMissileStrikeOrder,
  type StagedMoveOrder,
  type StagedNavalMoveOrder,
  type StagedNavalStrikeOrder,
  type StagedOrder,
  type StagedRebaseAirOrder,
  type StagedResupplyOrder,
} from "@/state/orders";
import type { OrderDTO } from "@/types/orders";
import { suggestOrders } from "@/api/suggestOrders";
import { loadScenario } from "@/api/loadScenario";
import type {
  SortieMissionDTO,
  StrikeTargetKindDTO,
} from "@/types/orders";
import {
  buildActionDraft,
  type ActionDraft,
  type ActionDraftCandidate,
  type DraftSpec,
} from "@/state/actionDraft";
import { executeRound } from "@/api/executeRound";
import {
  buildReplayEvents,
  type ReplayEvent,
  type ReplayPhase,
  type ReplayEngageEvent,
  type ReplayStrikeEvent,
} from "@/state/replay";
import { planStrikes } from "@/map/layers/strikeArcLayer";
import { greatCircleInterpolate, haversineKm } from "@/map/geodesic";

export type LayerKey =
  | "oblasts"
  | "cities"
  | "units_ground"
  | "units_air"
  | "units_naval"
  | "depots"
  | "airfields"
  | "naval_bases"
  | "border_crossings"
  | "supply_lines"
  | "missile_ranges"
  | "frontline";

export const ALL_LAYERS: LayerKey[] = [
  "oblasts",
  "cities",
  "units_ground",
  "units_air",
  "units_naval",
  "depots",
  "airfields",
  "naval_bases",
  "border_crossings",
  "supply_lines",
  "missile_ranges",
  "frontline",
];

export type RightTab = "prompt" | "context" | "decision";

export interface HoverPayload {
  kind: SelectableKind;
  id: string;
  x: number;
  y: number;
}

export interface MeasurePoint {
  lon: number;
  lat: number;
}

export interface Bookmark {
  id: string;
  label: string;
  center: [number, number];
  zoom: number;
  pitch?: number;
  bearing?: number;
}

interface AppState {
  scenario: ScenarioSnapshot | null;
  loadError: string | null;

  intel: IntelSnapshot | null;
  intelError: string | null;
  lastIntelLoadAt: number | null;
  intelTickIntervalMs: number;

  selection: Selection;
  hover: HoverPayload | null;
  visibleLayers: Record<LayerKey, boolean>;
  selectedActionId: string | null;

  choroplethMetric: ChoroplethMetric;
  rosterOpen: boolean;
  rosterCompareIds: string[];

  rightTab: RightTab;
  rightPanelOpen: boolean;
  /** Full-viewport decision workspace (map behind overlay; PIP + thin ticker). */
  decisionImmersiveOpen: boolean;
  leftDockOpen: boolean;
  oobExpanded: Record<string, boolean>;
  bookmarks: Bookmark[];
  measureActive: boolean;
  measurePath: MeasurePoint[];
  tickerPaused: boolean;
  showHelp: boolean;

  /** Article currently shown in the right-side ArticleDrawer (clicked from
   * the ticker, RegionSummary, or FactorFlowGraph signal nodes). */
  selectedArticle: IntelEvent | null;

  /** Adjudicated side for upcoming move / order affordances. */
  playerTeam: PlayerTeam;

  /** Per-unit ground move planning (map overlay + pending destination until “play”). */
  groundMoveDrafts: Record<string, GroundMoveDraft>;
  /** Ephemeral notice when a click is clamped to the movement ring. */
  moveRadiusToast: string | null;

  /** Single in-flight non-move order draft (engage / strike / rebase / etc).
   *  Map clicks snap to its candidate list while `pickingTarget` is true. */
  actionDraft: ActionDraft | null;
  /** Last "no candidates" / "snapped" toast surfaced by draft handlers. */
  actionDraftToast: string | null;

  /** Per-team shopping cart of staged orders pending Execute. */
  stagedOrders: Record<PlayerTeam, StagedOrder[]>;
  /** Per-team "Ready" lock. Both teams ready -> Execute fires the round. */
  roundReady: Record<PlayerTeam, boolean>;
  cartOpen: boolean;
  /** True while an OrderBatch is in-flight or being animated. */
  executing: boolean;
  /** Per-unit live position overrides used by the animator while orders apply. */
  unitPositionOverrides: Record<string, [number, number]>;
  /** Tick that bumps each time overrides change so map effects can re-run cheaply. */
  unitPositionOverridesEpoch: number;
  /** Last execute() error (transport-level), surfaced by the cart UI. */
  orderExecutionError: string | null;
  /** Last successful execution: outcome details + political summary (for the toast/cart). */
  lastExecutionResult: {
    at: number;
    outcomes: import("@/types/orders").OrderOutcomeDTO[];
    political_summary: Record<string, Record<string, number>>;
  } | null;

  /** Active phased replay of the most recent round, or null when idle.
   *  `phase` walks moves -> strikes -> reports; reports persists until
   *  the user clicks "Dismiss". */
  replay: { phase: ReplayPhase; events: ReplayEvent[] } | null;

  /** AssistantBar state: prompt-bar busy flag + last LLM result + last error.
   *  `assistantRationale` is the prose returned by the LLM and lives until
   *  dismissed or the next successful submit. */
  assistantBusy: boolean;
  assistantRationale: string | null;
  assistantWarnings: string[];
  assistantError: string | null;
  assistantStagedCount: number;
  /** Count of world edits applied by the most recent suggestion (e.g. SAM
   *  batteries the LLM stood up). Drives the "Deployed N" line. */
  assistantSpawnedCount: number;
  /** Transient pulse markers for entities the LLM spawned this round.
   *  The SpawnPulses overlay reads them, drops each entry once its CSS
   *  animation expires (~2.5s after `at`). */
  assistantSpawnPulses: SpawnPulse[];

  setScenario: (s: ScenarioSnapshot) => void;
  setLoadError: (e: string | null) => void;
  setIntel: (snapshot: IntelSnapshot) => void;
  setIntelError: (e: string | null) => void;
  select: (sel: Selection) => void;
  clearSelection: () => void;
  setHover: (h: HoverPayload | null) => void;
  toggleLayer: (k: LayerKey) => void;
  setLayer: (k: LayerKey, on: boolean) => void;
  selectAction: (id: string | null) => void;
  setChoroplethMetric: (m: ChoroplethMetric) => void;
  setRosterOpen: (open: boolean) => void;
  toggleRosterCompare: (countryId: string) => void;
  clearRosterCompare: () => void;
  setRightTab: (t: RightTab) => void;
  setRightPanelOpen: (open: boolean) => void;
  setDecisionImmersiveOpen: (open: boolean) => void;
  setLeftDockOpen: (open: boolean) => void;
  toggleOobNode: (id: string) => void;
  setOobExpanded: (id: string, on: boolean) => void;
  addBookmark: (b: Bookmark) => void;
  removeBookmark: (id: string) => void;
  setMeasureActive: (on: boolean) => void;
  pushMeasurePoint: (p: MeasurePoint) => void;
  clearMeasure: () => void;
  setTickerPaused: (p: boolean) => void;
  setShowHelp: (on: boolean) => void;
  openArticle: (ev: IntelEvent) => void;
  closeArticle: () => void;
  setPlayerTeam: (t: PlayerTeam) => void;
  intelByRegion: () => Map<string, RegionIntel>;

  startGroundMove: (unitId: string, mode: GroundMoveMode) => void;
  setGroundMoveDestination: (unitId: string, dest: [number, number]) => void;
  confirmGroundMovePicking: (unitId: string) => void;
  cancelGroundMove: (unitId: string) => void;
  showMoveRadiusToast: (mode: GroundMoveMode) => void;
  dismissMoveRadiusToast: () => void;

  /** Open a non-move draft (range ring + candidate snap on the map). Returns a
   *  warning string when the draft was opened but no candidates exist; null on
   *  clean start; `"invalid"` when the spec doesn't match the scenario. */
  startActionDraft: (spec: DraftSpec) => string | null;
  /** Select a specific candidate (typically by clicking on the map).
   *  Pass null to deselect without cancelling the draft. */
  setActionDraftCandidate: (candidateId: string | null) => void;
  cancelActionDraft: () => void;
  /** Commit the draft to the staged-orders cart (calls the corresponding
   *  stage* helper). Returns the staged order id, or null if uncommittable. */
  commitActionDraft: () => string | null;
  dismissActionDraftToast: () => void;

  stageMoveFromDraft: (unitId: string) => string | null;
  stageEntrenchOrder: (unitId: string) => string | null;
  stageEngageOrder: (attackerId: string, targetId: string) => string | null;
  stageRebaseAir: (unitId: string, airfieldId: string) => string | null;
  stageAirSortie: (
    unitId: string,
    mission: SortieMissionDTO,
    target: { kind: StrikeTargetKindDTO; id: string },
  ) => string | null;
  stageNavalMove: (unitId: string, dest: [number, number]) => string | null;
  stageNavalStrike: (
    unitId: string,
    target: { kind: StrikeTargetKindDTO; id: string },
  ) => string | null;
  stageMissileStrike: (
    platformId: string,
    target: { kind: StrikeTargetKindDTO; id: string },
  ) => string | null;
  stageResupply: (depotId: string, unitId: string) => string | null;
  stageInterdictSupply: (
    platformKind: "air_wing" | "missile_range",
    platformId: string,
    supplyLineId: string,
  ) => string | null;
  removeStagedOrder: (id: string) => void;
  clearStagedOrders: (team?: PlayerTeam) => void;
  setCartOpen: (open: boolean) => void;
  /** Toggle a team's Ready lock. Locked teams cannot stage/remove orders. */
  setRoundReady: (team: PlayerTeam, ready: boolean) => void;
  /** Hot-seat round execute: requires both teams to be Ready. */
  executeRound: () => Promise<void>;
  /** Skip the current replay phase early. Auto-advances if not in `reports`. */
  skipReplayPhase: () => void;
  /** Dismiss the persistent damage chips and end the replay. */
  dismissReplay: () => void;
  dismissOrderExecutionError: () => void;

  /** AssistantBar: send a free-form prompt to the LLM and stage any returned
   *  orders (tagged `source: "llm"`). No-op while `roundReady[playerTeam]`. */
  submitAssistantPrompt: (prompt: string) => Promise<void>;
  /** Drop the in-place rationale strip and clear assistant warnings/errors. */
  dismissAssistant: () => void;
  /** Drop the spawn pulse for `id` once its animation has finished playing. */
  dismissSpawnPulse: (id: string) => void;
}

export interface SpawnPulse {
  id: string;
  kind: "missile_range" | "unit";
  team: PlayerTeam;
  name: string;
  position: [number, number];
  /** Wall-clock ms when the pulse was emitted, used to time the animation. */
  at: number;
}

export const useAppStore = create<AppState>((set, get) => ({
  scenario: null,
  loadError: null,

  intel: null,
  intelError: null,
  lastIntelLoadAt: null,
  intelTickIntervalMs: 5000,

  selection: null,
  hover: null,
  visibleLayers: {
    oblasts: true,
    cities: true,
    units_ground: true,
    units_air: true,
    units_naval: true,
    depots: true,
    airfields: true,
    naval_bases: true,
    border_crossings: false,
    supply_lines: true,
    missile_ranges: false,
    frontline: true,
  },
  selectedActionId: null,

  choroplethMetric: "war_support",
  rosterOpen: false,
  rosterCompareIds: [],

  rightTab: "context",
  rightPanelOpen: true,
  decisionImmersiveOpen: false,
  leftDockOpen: true,
  oobExpanded: {},
  bookmarks: [],
  measureActive: false,
  measurePath: [],
  tickerPaused: false,
  showHelp: false,
  selectedArticle: null,
  playerTeam: "blue",

  groundMoveDrafts: {},
  moveRadiusToast: null,
  actionDraft: null,
  actionDraftToast: null,

  stagedOrders: emptyTeamMap<StagedOrder[]>(() => []),
  roundReady: { red: false, blue: false },
  cartOpen: false,
  executing: false,
  unitPositionOverrides: {},
  unitPositionOverridesEpoch: 0,
  orderExecutionError: null,
  lastExecutionResult: null,
  replay: null,

  assistantBusy: false,
  assistantRationale: null,
  assistantWarnings: [],
  assistantError: null,
  assistantStagedCount: 0,
  assistantSpawnedCount: 0,
  assistantSpawnPulses: [],

  setScenario: (s) =>
    set((state) => ({
      scenario: s,
      loadError: null,
      selectedActionId: state.selectedActionId ?? s.actions[0]?.id ?? null,
    })),
  setLoadError: (e) => set({ loadError: e }),
  setIntel: (snapshot) =>
    set({ intel: snapshot, intelError: null, lastIntelLoadAt: Date.now() }),
  setIntelError: (e) => set({ intelError: e }),
  select: (sel) =>
    set((state) => {
      if (state.rightTab === "decision") {
        return { selection: sel, rightPanelOpen: true };
      }
      return {
        selection: sel,
        rightPanelOpen: true,
        rightTab: "context",
        decisionImmersiveOpen: false,
      };
    }),
  clearSelection: () => set({ selection: null }),
  setHover: (h) => set({ hover: h }),
  toggleLayer: (k) =>
    set((state) => ({
      visibleLayers: { ...state.visibleLayers, [k]: !state.visibleLayers[k] },
    })),
  setLayer: (k, on) =>
    set((state) => ({
      visibleLayers: { ...state.visibleLayers, [k]: on },
    })),
  selectAction: (id) => set({ selectedActionId: id }),
  setChoroplethMetric: (m) => set({ choroplethMetric: m }),
  setRosterOpen: (open) => set({ rosterOpen: open }),
  toggleRosterCompare: (countryId) =>
    set((state) => {
      const has = state.rosterCompareIds.includes(countryId);
      if (has) {
        return {
          rosterCompareIds: state.rosterCompareIds.filter((c) => c !== countryId),
        };
      }
      if (state.rosterCompareIds.length >= 4) return state;
      return { rosterCompareIds: [...state.rosterCompareIds, countryId] };
    }),
  clearRosterCompare: () => set({ rosterCompareIds: [] }),
  setRightTab: (t) =>
    set({
      rightTab: t,
      rightPanelOpen: true,
      decisionImmersiveOpen: t === "decision",
    }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setDecisionImmersiveOpen: (open) => set({ decisionImmersiveOpen: open }),
  setLeftDockOpen: (open) => set({ leftDockOpen: open }),
  toggleOobNode: (id) =>
    set((state) => ({
      oobExpanded: { ...state.oobExpanded, [id]: !state.oobExpanded[id] },
    })),
  setOobExpanded: (id, on) =>
    set((state) => ({ oobExpanded: { ...state.oobExpanded, [id]: on } })),
  addBookmark: (b) =>
    set((state) => ({ bookmarks: [...state.bookmarks.filter((x) => x.id !== b.id), b] })),
  removeBookmark: (id) =>
    set((state) => ({ bookmarks: state.bookmarks.filter((b) => b.id !== id) })),
  setMeasureActive: (on) =>
    set((state) => ({
      measureActive: on,
      measurePath: on ? state.measurePath : [],
    })),
  pushMeasurePoint: (p) =>
    set((state) => ({ measurePath: [...state.measurePath, p] })),
  clearMeasure: () => set({ measurePath: [] }),
  setTickerPaused: (p) => set({ tickerPaused: p }),
  setShowHelp: (on) => set({ showHelp: on }),
  openArticle: (ev) => set({ selectedArticle: ev }),
  closeArticle: () => set({ selectedArticle: null }),
  setPlayerTeam: (t) =>
    set((s) =>
      s.playerTeam === t
        ? s
        : { playerTeam: t, groundMoveDrafts: {}, actionDraft: null, actionDraftToast: null },
    ),
  startGroundMove: (unitId, mode) => {
    const state0 = get();
    if (state0.roundReady[state0.playerTeam]) return;
    const sc = state0.scenario;
    const unit = sc?.units.find((u) => u.id === unitId);
    if (!unit || !isGroundCombatUnit(unit.domain)) return;
    const faction = sc?.factions.find((f) => f.id === unit.faction_id);
    if (!faction || faction.allegiance !== state0.playerTeam) return;
    set((state) => {
      const prev = state.groundMoveDrafts[unitId];
      const keepDest = prev?.mode === mode ? prev.destination : null;
      return {
        groundMoveDrafts: {
          ...state.groundMoveDrafts,
          [unitId]: {
            mode,
            origin: [unit.position[0], unit.position[1]],
            destination: keepDest,
            pickingDestination: true,
          },
        },
      };
    });
  },
  setGroundMoveDestination: (unitId, dest) =>
    set((state) => {
      const d = state.groundMoveDrafts[unitId];
      if (!d || !d.pickingDestination) return state;
      return {
        groundMoveDrafts: {
          ...state.groundMoveDrafts,
          [unitId]: { ...d, destination: dest },
        },
      };
    }),
  confirmGroundMovePicking: (unitId) =>
    set((state) => {
      const d = state.groundMoveDrafts[unitId];
      if (!d) return state;
      return {
        groundMoveDrafts: {
          ...state.groundMoveDrafts,
          [unitId]: { ...d, pickingDestination: false },
        },
      };
    }),
  cancelGroundMove: (unitId) =>
    set((state) => {
      const next = { ...state.groundMoveDrafts };
      delete next[unitId];
      return { groundMoveDrafts: next };
    }),
  showMoveRadiusToast: (mode) => set({ moveRadiusToast: moveRadiusToastMessage(mode) }),
  dismissMoveRadiusToast: () => set({ moveRadiusToast: null }),

  startActionDraft: (spec) => {
    const state0 = get();
    if (state0.roundReady[state0.playerTeam]) {
      set({ actionDraftToast: "Team is ready. Unready to plan more orders." });
      return "invalid";
    }
    const sc = state0.scenario;
    if (!sc) return "invalid";
    const built = buildActionDraft(sc, state0.playerTeam, spec);
    if (!built) {
      set({ actionDraftToast: "Cannot start action: invalid origin." });
      return "invalid";
    }
    set({
      actionDraft: built.draft,
      actionDraftToast: built.warning,
      groundMoveDrafts: {},
    });
    return built.warning;
  },
  setActionDraftCandidate: (candidateId) =>
    set((s) => {
      const d = s.actionDraft;
      if (!d) return s;
      if (candidateId == null) {
        return { actionDraft: { ...d, selectedCandidateId: null } };
      }
      const ok = d.candidates.some((c) => c.id === candidateId);
      if (!ok) return s;
      return { actionDraft: { ...d, selectedCandidateId: candidateId } };
    }),
  cancelActionDraft: () => set({ actionDraft: null, actionDraftToast: null }),
  dismissActionDraftToast: () => set({ actionDraftToast: null }),
  commitActionDraft: () => {
    const state = get();
    const d = state.actionDraft;
    if (!d) return null;
    const cid = d.selectedCandidateId;
    if (!cid) return null;
    const cand = d.candidates.find((c) => c.id === cid);
    if (!cand) return null;
    const staged = stagedFromActionDraft(d, cand, state);
    if (!staged) return null;
    set({ actionDraft: null, actionDraftToast: null });
    return staged;
  },

  stageMoveFromDraft: (unitId) => {
    const state = get();
    if (state.roundReady[state.playerTeam]) return null;
    const draft = state.groundMoveDrafts[unitId];
    if (!draft || !draft.destination) return null;
    const sc = state.scenario;
    const unit = sc?.units.find((u) => u.id === unitId);
    if (!unit) return null;
    const faction = sc?.factions.find((f) => f.id === unit.faction_id);
    if (!faction || faction.allegiance !== state.playerTeam) return null;

    const id = newOrderId("ord.move");
    const order: StagedMoveOrder = {
      id,
      kind: "move",
      team: state.playerTeam,
      unitId,
      mode: draft.mode,
      origin: [draft.origin[0], draft.origin[1]],
      destination: [draft.destination[0], draft.destination[1]],
    };
    set((s) => {
      const teamOrders = s.stagedOrders[s.playerTeam];
      const filtered = dedupeByOwner(teamOrders, order);
      const nextDrafts = { ...s.groundMoveDrafts };
      delete nextDrafts[unitId];
      return {
        stagedOrders: {
          ...s.stagedOrders,
          [s.playerTeam]: [...filtered, order],
        },
        groundMoveDrafts: nextDrafts,
        cartOpen: true,
      };
    });
    return id;
  },
  stageEntrenchOrder: (unitId) => {
    const state = get();
    const sc = state.scenario;
    const unit = sc?.units.find((u) => u.id === unitId);
    if (!unit) return null;
    const faction = sc?.factions.find((f) => f.id === unit.faction_id);
    if (!faction || faction.allegiance !== state.playerTeam) return null;
    if (unit.domain !== "ground") return null;
    const id = newOrderId("ord.entrench");
    const order: StagedEntrenchOrder = {
      id, kind: "entrench", team: state.playerTeam,
      unitId, unitName: unit.name,
    };
    return commitStaged(set, state.playerTeam, order);
  },
  stageEngageOrder: (attackerId, targetId) => {
    const state = get();
    const sc = state.scenario;
    if (!sc) return null;
    const attacker = sc.units.find((u) => u.id === attackerId);
    const target = sc.units.find((u) => u.id === targetId);
    if (!attacker || !target) return null;
    const faction = sc.factions.find((f) => f.id === attacker.faction_id);
    if (!faction || faction.allegiance !== state.playerTeam) return null;
    if (attacker.faction_id === target.faction_id) return null;
    const id = newOrderId("ord.engage");
    const order: StagedEngageOrder = {
      id, kind: "engage", team: state.playerTeam,
      attackerId, attackerName: attacker.name,
      targetId, targetName: target.name,
      rangeKm: haversineKm(attacker.position, target.position),
    };
    return commitStaged(set, state.playerTeam, order);
  },
  stageRebaseAir: (unitId, airfieldId) => {
    const state = get();
    const sc = state.scenario;
    if (!sc) return null;
    const unit = sc.units.find((u) => u.id === unitId);
    const airfield = sc.airfields.find((a) => a.id === airfieldId);
    if (!unit || !airfield) return null;
    const faction = sc.factions.find((f) => f.id === unit.faction_id);
    if (!faction || faction.allegiance !== state.playerTeam) return null;
    if (unit.domain !== "air") return null;
    const id = newOrderId("ord.rebase");
    const order: StagedRebaseAirOrder = {
      id, kind: "rebase_air", team: state.playerTeam,
      unitId, unitName: unit.name,
      airfieldId, airfieldName: airfield.name,
      origin: [unit.position[0], unit.position[1]],
      destination: [airfield.position[0], airfield.position[1]],
    };
    return commitStaged(set, state.playerTeam, order);
  },
  stageAirSortie: (unitId, mission, target) => {
    const state = get();
    const sc = state.scenario;
    if (!sc) return null;
    const unit = sc.units.find((u) => u.id === unitId);
    if (!unit || unit.domain !== "air") return null;
    const faction = sc.factions.find((f) => f.id === unit.faction_id);
    if (!faction || faction.allegiance !== state.playerTeam) return null;
    const lookup = lookupTarget(sc, target.kind, target.id);
    if (!lookup) return null;
    const id = newOrderId(`ord.sortie.${mission}`);
    const order: StagedAirSortieOrder = {
      id, kind: "air_sortie", team: state.playerTeam,
      unitId, unitName: unit.name, mission,
      targetKind: target.kind, targetId: target.id, targetName: lookup.name,
      origin: [unit.position[0], unit.position[1]],
      targetPos: lookup.pos,
    };
    return commitStaged(set, state.playerTeam, order);
  },
  stageNavalMove: (unitId, dest) => {
    const state = get();
    const sc = state.scenario;
    if (!sc) return null;
    const unit = sc.units.find((u) => u.id === unitId);
    if (!unit || unit.domain !== "naval") return null;
    const faction = sc.factions.find((f) => f.id === unit.faction_id);
    if (!faction || faction.allegiance !== state.playerTeam) return null;
    const id = newOrderId("ord.naval_move");
    const order: StagedNavalMoveOrder = {
      id, kind: "naval_move", team: state.playerTeam,
      unitId, unitName: unit.name,
      origin: [unit.position[0], unit.position[1]],
      destination: dest,
    };
    return commitStaged(set, state.playerTeam, order);
  },
  stageNavalStrike: (unitId, target) => {
    const state = get();
    const sc = state.scenario;
    if (!sc) return null;
    const unit = sc.units.find((u) => u.id === unitId);
    if (!unit || unit.domain !== "naval") return null;
    const faction = sc.factions.find((f) => f.id === unit.faction_id);
    if (!faction || faction.allegiance !== state.playerTeam) return null;
    const lookup = lookupTarget(sc, target.kind, target.id);
    if (!lookup) return null;
    const id = newOrderId("ord.naval_strike");
    const order: StagedNavalStrikeOrder = {
      id, kind: "naval_strike", team: state.playerTeam,
      unitId, unitName: unit.name,
      targetKind: target.kind, targetId: target.id, targetName: lookup.name,
      origin: [unit.position[0], unit.position[1]],
      targetPos: lookup.pos,
    };
    return commitStaged(set, state.playerTeam, order);
  },
  stageMissileStrike: (platformId, target) => {
    const state = get();
    const sc = state.scenario;
    if (!sc) return null;
    const platform = sc.missile_ranges.find((m) => m.id === platformId);
    if (!platform) return null;
    const faction = sc.factions.find((f) => f.id === platform.faction_id);
    if (!faction || faction.allegiance !== state.playerTeam) return null;
    const lookup = lookupTarget(sc, target.kind, target.id);
    if (!lookup) return null;
    const id = newOrderId("ord.missile");
    const order: StagedMissileStrikeOrder = {
      id, kind: "missile_strike", team: state.playerTeam,
      platformId, platformName: platform.name,
      targetKind: target.kind, targetId: target.id, targetName: lookup.name,
      origin: [platform.origin[0], platform.origin[1]],
      targetPos: lookup.pos,
    };
    return commitStaged(set, state.playerTeam, order);
  },
  stageResupply: (depotId, unitId) => {
    const state = get();
    const sc = state.scenario;
    if (!sc) return null;
    const depot = sc.depots.find((d) => d.id === depotId);
    const unit = sc.units.find((u) => u.id === unitId);
    if (!depot || !unit) return null;
    const faction = sc.factions.find((f) => f.id === depot.faction_id);
    if (!faction || faction.allegiance !== state.playerTeam) return null;
    const id = newOrderId("ord.resupply");
    const order: StagedResupplyOrder = {
      id, kind: "resupply", team: state.playerTeam,
      depotId, depotName: depot.name,
      unitId, unitName: unit.name,
    };
    return commitStaged(set, state.playerTeam, order);
  },
  stageInterdictSupply: (platformKind, platformId, supplyLineId) => {
    const state = get();
    const sc = state.scenario;
    if (!sc) return null;
    const supplyLine = sc.supply_lines.find((s) => s.id === supplyLineId);
    if (!supplyLine) return null;
    let origin: [number, number];
    let platformName: string;
    let factionId: string;
    if (platformKind === "air_wing") {
      const u = sc.units.find((x) => x.id === platformId);
      if (!u || u.domain !== "air") return null;
      origin = [u.position[0], u.position[1]];
      platformName = u.name;
      factionId = u.faction_id;
    } else {
      const m = sc.missile_ranges.find((x) => x.id === platformId);
      if (!m || m.category === "sam") return null;
      origin = [m.origin[0], m.origin[1]];
      platformName = m.name;
      factionId = m.faction_id;
    }
    const faction = sc.factions.find((f) => f.id === factionId);
    if (!faction || faction.allegiance !== state.playerTeam) return null;
    const mid = supplyLineMidpoint(supplyLine.path);
    const id = newOrderId("ord.interdict");
    const order: StagedInterdictSupplyOrder = {
      id, kind: "interdict_supply", team: state.playerTeam,
      platformKind, platformId, platformName,
      supplyLineId, supplyLineName: supplyLine.name,
      origin, targetPos: mid,
    };
    return commitStaged(set, state.playerTeam, order);
  },
  removeStagedOrder: (id) =>
    set((s) => {
      const next: Record<PlayerTeam, StagedOrder[]> = {
        red: s.roundReady.red ? s.stagedOrders.red : s.stagedOrders.red.filter((o) => o.id !== id),
        blue: s.roundReady.blue ? s.stagedOrders.blue : s.stagedOrders.blue.filter((o) => o.id !== id),
      };
      return { stagedOrders: next };
    }),
  clearStagedOrders: (team) =>
    set((s) => {
      if (team) {
        if (s.roundReady[team]) return s;
        return { stagedOrders: { ...s.stagedOrders, [team]: [] } };
      }
      const next: Record<PlayerTeam, StagedOrder[]> = {
        red: s.roundReady.red ? s.stagedOrders.red : [],
        blue: s.roundReady.blue ? s.stagedOrders.blue : [],
      };
      return { stagedOrders: next };
    }),
  setCartOpen: (open) => set({ cartOpen: open }),
  setRoundReady: (team, ready) =>
    set((s) => {
      if (!ready) {
        return { roundReady: { ...s.roundReady, [team]: false } };
      }
      const isActive = s.playerTeam === team;
      return {
        roundReady: { ...s.roundReady, [team]: true },
        actionDraft: isActive ? null : s.actionDraft,
        actionDraftToast: isActive ? null : s.actionDraftToast,
        groundMoveDrafts: isActive ? {} : s.groundMoveDrafts,
      };
    }),
  executeRound: async () => {
    const state = get();
    if (state.executing) return;
    if (!state.roundReady.red || !state.roundReady.blue) return;
    const scenarioBefore = state.scenario;
    if (!scenarioBefore) return;

    const batches = (["blue", "red"] as PlayerTeam[]).map((team) =>
      batchFromStaged(team, state.stagedOrders[team]),
    );
    const allOrders: StagedOrder[] = [
      ...state.stagedOrders.blue,
      ...state.stagedOrders.red,
    ];

    set({ executing: true, orderExecutionError: null });
    try {
      const result = await executeRound({ batches });
      if (!result.ok) {
        const failed = Object.values(result.outcomes_by_team)
          .flat()
          .filter((o) => !o.ok);
        const summary =
          failed.length === 0
            ? "Some orders were rejected."
            : failed.map((o) => `· ${o.message}`).join("\n");
        set({ executing: false, orderExecutionError: summary });
        return;
      }

      const events = buildReplayEvents(
        scenarioBefore, allOrders, result.outcomes_by_team,
      );
      const flatOutcomes = [
        ...(result.outcomes_by_team.blue ?? []),
        ...(result.outcomes_by_team.red ?? []),
      ];

      // Phase 1: moves. Tween position overrides; existing animator.
      set({ replay: { phase: "moves", events } });
      await animateMoveOrders(allOrders, set, get);

      // Phase 2: strikes. Duration auto-fits the planned animation (stagger +
      // longest arc + tail), so dense rounds get a longer phase without
      // collapsing into one frame.
      set({ replay: { phase: "strikes", events } });
      const kinetic = events.filter(
        (e): e is ReplayStrikeEvent | ReplayEngageEvent =>
          e.kind === "strike" || e.kind === "engage",
      );
      const strikeMs = kinetic.length === 0
        ? STRIKE_PHASE_MIN_MS
        : Math.max(STRIKE_PHASE_MIN_MS, planStrikes(kinetic).totalDurationMs);
      await waitPhase(strikeMs);

      // Phase 3: reports. Persistent damage chips. Commit snapshot now so the
      // map reflects the post-round world; chips remain until user dismisses.
      set((s) => ({
        scenario: result.snapshot,
        stagedOrders: emptyTeamMap<StagedOrder[]>(() => []),
        roundReady: { red: false, blue: false },
        unitPositionOverrides: {},
        unitPositionOverridesEpoch: s.unitPositionOverridesEpoch + 1,
        executing: false,
        replay: { phase: "reports", events },
        lastExecutionResult: {
          at: Date.now(),
          outcomes: flatOutcomes,
          political_summary: result.political_summary,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ executing: false, orderExecutionError: message, replay: null });
      cancelPendingPhase();
    }
  },
  skipReplayPhase: () => {
    const r = get().replay;
    if (!r || r.phase === "reports") return;
    cancelPendingPhase();
  },
  dismissReplay: () => set({ replay: null }),
  dismissOrderExecutionError: () => set({ orderExecutionError: null }),

  submitAssistantPrompt: async (prompt) => {
    const text = prompt.trim();
    if (!text) return;
    const state = get();
    if (state.assistantBusy) return;
    if (!state.scenario) return;
    if (state.roundReady[state.playerTeam]) {
      set({ assistantError: "Team is ready. Unready to plan more orders." });
      return;
    }
    set({
      assistantBusy: true,
      assistantError: null,
      assistantWarnings: [],
      assistantRationale: null,
      assistantStagedCount: 0,
      assistantSpawnedCount: 0,
    });
    try {
      const team = state.playerTeam;
      const res = await suggestOrders({ prompt: text, issuer_team: team });

      // Edits mutated the live theatre; refresh the FE snapshot first so
      // any LLM orders referencing the spawned ids resolve cleanly.
      if (res.edits.length > 0) {
        try {
          const fresh = await loadScenario();
          set({ scenario: fresh });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn("[assistant] failed to refresh scenario after edits", message);
        }
      }

      const { staged, rejected } = applyLlmSuggestionsToCart(res.orders, team, set, get);
      const warnings = [...res.warnings, ...rejected];
      const pulses = res.edits.map<SpawnPulse>((e) => ({
        id: e.id,
        kind: e.kind === "spawn_missile_range" ? "missile_range" : "unit",
        team,
        name: e.name,
        position: [e.position[0], e.position[1]],
        at: Date.now(),
      }));
      set((s) => ({
        assistantBusy: false,
        assistantRationale: res.rationale || null,
        assistantWarnings: warnings,
        assistantStagedCount: staged,
        assistantSpawnedCount: res.edits.length,
        assistantSpawnPulses: [...s.assistantSpawnPulses, ...pulses],
        cartOpen: staged > 0 || s.cartOpen,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ assistantBusy: false, assistantError: message });
    }
  },
  dismissAssistant: () =>
    set({
      assistantRationale: null,
      assistantWarnings: [],
      assistantError: null,
      assistantStagedCount: 0,
      assistantSpawnedCount: 0,
    }),
  dismissSpawnPulse: (id) =>
    set((s) => ({
      assistantSpawnPulses: s.assistantSpawnPulses.filter((p) => p.id !== id),
    })),

  intelByRegion: () => {
    const intel = get().intel;
    const out = new Map<string, RegionIntel>();
    if (!intel) return out;
    for (const r of intel.regions) out.set(r.region_id, r);
    return out;
  },
}));

const MOVE_ANIMATION_MS = 2200;
/** Minimum strike phase even with zero kinetic events, so the pill is legible. */
const STRIKE_PHASE_MIN_MS = 600;

/** Phase-wait plumbing. Each `waitPhase(ms)` resolves either after `ms` or
 *  when `cancelPendingPhase` is called (Skip button). The move animator also
 *  cooperates with the same flag to short-circuit its rAF loop. */
let _phaseResolver: (() => void) | null = null;
let _phaseTimer: ReturnType<typeof setTimeout> | null = null;
let _phaseSkipped = false;
function waitPhase(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    _phaseSkipped = false;
    _phaseResolver = resolve;
    _phaseTimer = setTimeout(() => {
      _phaseTimer = null;
      const r = _phaseResolver;
      _phaseResolver = null;
      r?.();
    }, ms);
  });
}
function cancelPendingPhase(): void {
  _phaseSkipped = true;
  if (_phaseTimer !== null) {
    clearTimeout(_phaseTimer);
    _phaseTimer = null;
  }
  const r = _phaseResolver;
  _phaseResolver = null;
  r?.();
}
function isPhaseSkipped(): boolean { return _phaseSkipped; }

/** Tween each position-changing order along its geodesic origin -> destination.
 *
 *  Writes a transient `unitPositionOverrides` map that the units layer reads
 *  before falling back to scenario position. Resolves once the tween ends,
 *  letting the executor commit the authoritative server snapshot.
 */
function animateMoveOrders(
  orders: StagedOrder[],
  set: (
    partial:
      | Partial<AppState>
      | ((s: AppState) => Partial<AppState>),
  ) => void,
  _get: () => AppState,
): Promise<void> {
  const tweens: { unitId: string; from: [number, number]; to: [number, number] }[] = [];
  for (const o of orders) {
    if (o.kind === "move" || o.kind === "naval_move") {
      tweens.push({ unitId: o.unitId, from: o.origin, to: o.destination });
    } else if (o.kind === "rebase_air") {
      tweens.push({ unitId: o.unitId, from: o.origin, to: o.destination });
    }
  }
  if (tweens.length === 0) return Promise.resolve();

  return new Promise<void>((resolve) => {
    _phaseSkipped = false;
    const start = performance.now();
    const step = () => {
      const elapsed = performance.now() - start;
      const t = isPhaseSkipped() ? 1 : Math.min(1, elapsed / MOVE_ANIMATION_MS);
      const eased = easeInOutCubic(t);
      const overrides: Record<string, [number, number]> = {};
      for (const m of tweens) {
        overrides[m.unitId] = greatCircleInterpolate(m.from, m.to, eased);
      }
      set((s) => ({
        unitPositionOverrides: overrides,
        unitPositionOverridesEpoch: s.unitPositionOverridesEpoch + 1,
      }));
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

// ---------------------------------------------------------------------------
// Staging helpers
// ---------------------------------------------------------------------------

type SetFn = (
  partial:
    | Partial<AppState>
    | ((s: AppState) => Partial<AppState>),
) => void;

/** Drop any prior staged order owned by the same unit/platform. One per slot. */
function dedupeByOwner(
  existing: StagedOrder[],
  incoming: StagedOrder,
): StagedOrder[] {
  const owner = ownerKey(incoming);
  if (!owner) return existing;
  return existing.filter((o) => ownerKey(o) !== owner);
}

function commitStaged(
  set: SetFn,
  team: PlayerTeam,
  order: StagedOrder,
): string | null {
  let committed = true;
  set((s) => {
    if (s.roundReady[team]) {
      committed = false;
      return s;
    }
    const filtered = dedupeByOwner(s.stagedOrders[team], order);
    return {
      stagedOrders: { ...s.stagedOrders, [team]: [...filtered, order] },
      cartOpen: true,
    };
  });
  return committed ? order.id : null;
}

interface TargetLookup {
  pos: [number, number];
  name: string;
}

function lookupTarget(
  sc: ScenarioSnapshot,
  kind: import("@/types/orders").StrikeTargetKindDTO,
  id: string,
): TargetLookup | null {
  switch (kind) {
    case "unit": {
      const u = sc.units.find((x) => x.id === id);
      return u ? { pos: [u.position[0], u.position[1]], name: u.name } : null;
    }
    case "depot": {
      const d = sc.depots.find((x) => x.id === id);
      return d ? { pos: [d.position[0], d.position[1]], name: d.name } : null;
    }
    case "airfield": {
      const a = sc.airfields.find((x) => x.id === id);
      return a ? { pos: [a.position[0], a.position[1]], name: a.name } : null;
    }
    case "naval_base": {
      const n = sc.naval_bases.find((x) => x.id === id);
      return n ? { pos: [n.position[0], n.position[1]], name: n.name } : null;
    }
    case "missile_range": {
      const m = sc.missile_ranges.find((x) => x.id === id);
      return m ? { pos: [m.origin[0], m.origin[1]], name: m.name } : null;
    }
    case "supply_line": {
      const s = sc.supply_lines.find((x) => x.id === id);
      if (!s) return null;
      return { pos: supplyLineMidpoint(s.path), name: s.name };
    }
    case "city": {
      const c = sc.cities.find((x) => x.id === id);
      return c ? { pos: [c.position[0], c.position[1]], name: c.name } : null;
    }
  }
}

function supplyLineMidpoint(path: [number, number][]): [number, number] {
  if (path.length === 0) return [0, 0];
  if (path.length === 1) return [path[0][0], path[0][1]];
  if (path.length % 2 === 1) {
    const m = path[(path.length - 1) / 2];
    return [m[0], m[1]];
  }
  const a = path[path.length / 2 - 1];
  const b = path[path.length / 2];
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Map a confirmed action draft to a staged-order id by reusing the existing
 *  per-kind staging helpers on the store. Returns the staged id or null. */
function stagedFromActionDraft(
  d: ActionDraft,
  cand: ActionDraftCandidate,
  state: AppState,
): string | null {
  switch (d.kind) {
    case "engage":
      return state.stageEngageOrder(d.attackerId, cand.id);
    case "rebase_air":
      return state.stageRebaseAir(d.unitId, cand.id);
    case "air_sortie":
      return state.stageAirSortie(d.unitId, d.mission, {
        kind: candidateKindToStrike(cand.candidateKind),
        id: cand.id,
      });
    case "naval_move":
      return state.stageNavalMove(d.unitId, [cand.position[0], cand.position[1]]);
    case "naval_strike":
      return state.stageNavalStrike(d.unitId, {
        kind: candidateKindToStrike(cand.candidateKind),
        id: cand.id,
      });
    case "missile_strike":
      return state.stageMissileStrike(d.platformId, {
        kind: candidateKindToStrike(cand.candidateKind),
        id: cand.id,
      });
    case "interdict_supply":
      return state.stageInterdictSupply(d.platformKind, d.platformId, cand.id);
  }
}

function candidateKindToStrike(
  k: ActionDraftCandidate["candidateKind"],
): StrikeTargetKindDTO {
  return k as StrikeTargetKindDTO;
}

// ---------------------------------------------------------------------------
// LLM suggestion staging
// ---------------------------------------------------------------------------

/** Walk an LLM-returned `OrderDTO[]`, build matching `StagedOrder`s tagged
 *  `source: "llm"`, and append them to the active team's cart.
 *
 *  Mirrors the per-kind ownership / shape checks used by the manual stage*
 *  helpers but writes the team list in one pass to avoid N intermediate
 *  re-renders. Returns counts so the assistant strip can surface them.
 */
function applyLlmSuggestionsToCart(
  dtos: OrderDTO[],
  team: PlayerTeam,
  set: SetFn,
  get: () => AppState,
): { staged: number; rejected: string[] } {
  const state = get();
  const sc = state.scenario;
  if (!sc) return { staged: 0, rejected: ["scenario not loaded"] };

  const rejected: string[] = [];
  const built: StagedOrder[] = [];

  for (const dto of dtos) {
    const order = buildStagedFromDto(dto, team, sc, rejected);
    if (order) built.push(order);
  }

  if (built.length === 0) {
    return { staged: 0, rejected };
  }

  set((s) => {
    if (s.roundReady[team]) {
      rejected.push("team is ready; orders not staged");
      return s;
    }
    let teamOrders = s.stagedOrders[team];
    for (const o of built) {
      teamOrders = dedupeByOwner(teamOrders, o);
      teamOrders = [...teamOrders, o];
    }
    return {
      stagedOrders: { ...s.stagedOrders, [team]: teamOrders },
    };
  });

  return { staged: built.length, rejected };
}

function buildStagedFromDto(
  dto: OrderDTO,
  team: PlayerTeam,
  sc: ScenarioSnapshot,
  rejected: string[],
): StagedOrder | null {
  const factionAllegiance = (factionId: string): "red" | "blue" | "neutral" | undefined =>
    sc.factions.find((f) => f.id === factionId)?.allegiance;

  switch (dto.kind) {
    case "move": {
      const u = sc.units.find((x) => x.id === dto.unit_id);
      if (!u) return rej(rejected, dto, "unknown unit");
      if (factionAllegiance(u.faction_id) !== team) return rej(rejected, dto, "unit not on team");
      const order: StagedMoveOrder = {
        id: dto.order_id || newOrderId("ord.move"),
        kind: "move", team, source: "llm",
        unitId: dto.unit_id, mode: dto.mode,
        origin: [u.position[0], u.position[1]],
        destination: [dto.destination[0], dto.destination[1]],
      };
      return order;
    }
    case "entrench": {
      const u = sc.units.find((x) => x.id === dto.unit_id);
      if (!u) return rej(rejected, dto, "unknown unit");
      if (factionAllegiance(u.faction_id) !== team) return rej(rejected, dto, "unit not on team");
      const order: StagedEntrenchOrder = {
        id: dto.order_id || newOrderId("ord.entrench"),
        kind: "entrench", team, source: "llm",
        unitId: dto.unit_id, unitName: u.name,
      };
      return order;
    }
    case "engage": {
      const a = sc.units.find((x) => x.id === dto.attacker_id);
      const t = sc.units.find((x) => x.id === dto.target_id);
      if (!a || !t) return rej(rejected, dto, "unknown unit(s)");
      if (factionAllegiance(a.faction_id) !== team) return rej(rejected, dto, "attacker not on team");
      if (a.faction_id === t.faction_id) return rej(rejected, dto, "cannot engage own faction");
      const order: StagedEngageOrder = {
        id: dto.order_id || newOrderId("ord.engage"),
        kind: "engage", team, source: "llm",
        attackerId: a.id, attackerName: a.name,
        targetId: t.id, targetName: t.name,
        rangeKm: haversineKm(a.position, t.position),
      };
      return order;
    }
    case "rebase_air": {
      const u = sc.units.find((x) => x.id === dto.unit_id);
      const af = sc.airfields.find((x) => x.id === dto.airfield_id);
      if (!u || !af) return rej(rejected, dto, "unknown unit/airfield");
      if (u.domain !== "air") return rej(rejected, dto, "rebase requires an air unit");
      if (factionAllegiance(u.faction_id) !== team) return rej(rejected, dto, "unit not on team");
      const order: StagedRebaseAirOrder = {
        id: dto.order_id || newOrderId("ord.rebase"),
        kind: "rebase_air", team, source: "llm",
        unitId: u.id, unitName: u.name,
        airfieldId: af.id, airfieldName: af.name,
        origin: [u.position[0], u.position[1]],
        destination: [af.position[0], af.position[1]],
      };
      return order;
    }
    case "air_sortie": {
      const u = sc.units.find((x) => x.id === dto.unit_id);
      if (!u) return rej(rejected, dto, "unknown unit");
      if (u.domain !== "air") return rej(rejected, dto, "sortie requires an air unit");
      if (factionAllegiance(u.faction_id) !== team) return rej(rejected, dto, "unit not on team");
      const lookup = lookupTarget(sc, dto.target_kind, dto.target_id);
      if (!lookup) return rej(rejected, dto, "unknown target");
      const order: StagedAirSortieOrder = {
        id: dto.order_id || newOrderId(`ord.sortie.${dto.mission}`),
        kind: "air_sortie", team, source: "llm",
        unitId: u.id, unitName: u.name, mission: dto.mission,
        targetKind: dto.target_kind, targetId: dto.target_id, targetName: lookup.name,
        origin: [u.position[0], u.position[1]],
        targetPos: lookup.pos,
      };
      return order;
    }
    case "naval_move": {
      const u = sc.units.find((x) => x.id === dto.unit_id);
      if (!u) return rej(rejected, dto, "unknown unit");
      if (u.domain !== "naval") return rej(rejected, dto, "naval move requires naval unit");
      if (factionAllegiance(u.faction_id) !== team) return rej(rejected, dto, "unit not on team");
      const order: StagedNavalMoveOrder = {
        id: dto.order_id || newOrderId("ord.naval_move"),
        kind: "naval_move", team, source: "llm",
        unitId: u.id, unitName: u.name,
        origin: [u.position[0], u.position[1]],
        destination: [dto.destination[0], dto.destination[1]],
      };
      return order;
    }
    case "naval_strike": {
      const u = sc.units.find((x) => x.id === dto.unit_id);
      if (!u) return rej(rejected, dto, "unknown unit");
      if (u.domain !== "naval") return rej(rejected, dto, "naval strike requires naval unit");
      if (factionAllegiance(u.faction_id) !== team) return rej(rejected, dto, "unit not on team");
      const lookup = lookupTarget(sc, dto.target_kind, dto.target_id);
      if (!lookup) return rej(rejected, dto, "unknown target");
      const order: StagedNavalStrikeOrder = {
        id: dto.order_id || newOrderId("ord.naval_strike"),
        kind: "naval_strike", team, source: "llm",
        unitId: u.id, unitName: u.name,
        targetKind: dto.target_kind, targetId: dto.target_id, targetName: lookup.name,
        origin: [u.position[0], u.position[1]],
        targetPos: lookup.pos,
      };
      return order;
    }
    case "missile_strike": {
      const p = sc.missile_ranges.find((x) => x.id === dto.platform_id);
      if (!p) return rej(rejected, dto, "unknown missile platform");
      if (factionAllegiance(p.faction_id) !== team) return rej(rejected, dto, "platform not on team");
      const lookup = lookupTarget(sc, dto.target_kind, dto.target_id);
      if (!lookup) return rej(rejected, dto, "unknown target");
      const order: StagedMissileStrikeOrder = {
        id: dto.order_id || newOrderId("ord.missile"),
        kind: "missile_strike", team, source: "llm",
        platformId: p.id, platformName: p.name,
        targetKind: dto.target_kind, targetId: dto.target_id, targetName: lookup.name,
        origin: [p.origin[0], p.origin[1]],
        targetPos: lookup.pos,
      };
      return order;
    }
    case "resupply": {
      const d = sc.depots.find((x) => x.id === dto.depot_id);
      const u = sc.units.find((x) => x.id === dto.unit_id);
      if (!d || !u) return rej(rejected, dto, "unknown depot/unit");
      if (factionAllegiance(d.faction_id) !== team) return rej(rejected, dto, "depot not on team");
      const order: StagedResupplyOrder = {
        id: dto.order_id || newOrderId("ord.resupply"),
        kind: "resupply", team, source: "llm",
        depotId: d.id, depotName: d.name,
        unitId: u.id, unitName: u.name,
      };
      return order;
    }
    case "interdict_supply": {
      const sl = sc.supply_lines.find((x) => x.id === dto.supply_line_id);
      if (!sl) return rej(rejected, dto, "unknown supply line");
      let origin: [number, number];
      let platformName: string;
      let factionId: string;
      if (dto.platform_kind === "air_wing") {
        const u = sc.units.find((x) => x.id === dto.platform_id);
        if (!u || u.domain !== "air") return rej(rejected, dto, "invalid air platform");
        origin = [u.position[0], u.position[1]];
        platformName = u.name;
        factionId = u.faction_id;
      } else {
        const m = sc.missile_ranges.find((x) => x.id === dto.platform_id);
        if (!m || m.category === "sam") return rej(rejected, dto, "invalid missile platform");
        origin = [m.origin[0], m.origin[1]];
        platformName = m.name;
        factionId = m.faction_id;
      }
      if (factionAllegiance(factionId) !== team) return rej(rejected, dto, "platform not on team");
      const mid = supplyLineMidpoint(sl.path);
      const order: StagedInterdictSupplyOrder = {
        id: dto.order_id || newOrderId("ord.interdict"),
        kind: "interdict_supply", team, source: "llm",
        platformKind: dto.platform_kind, platformId: dto.platform_id, platformName,
        supplyLineId: sl.id, supplyLineName: sl.name,
        origin, targetPos: mid,
      };
      return order;
    }
  }
}

function rej(into: string[], dto: OrderDTO, reason: string): null {
  into.push(`${dto.order_id || dto.kind}: ${reason}`);
  return null;
}
