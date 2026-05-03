import { useMemo } from "react";
import { useAppStore } from "@/state/store";
import type { StagedOrder } from "@/state/orders";
import type { Faction, Unit } from "@/types/scenario";
import { haversineKm } from "@/map/geodesic";

/** Top-right "Orders" cart. Renders the active team's staged orders and an
 *  Execute button. Hidden entirely when nothing is staged for that team and
 *  the cart is closed (no chrome noise). */
export function OrdersCart() {
  const playerTeam = useAppStore((s) => s.playerTeam);
  const orders = useAppStore((s) => s.stagedOrders[s.playerTeam]);
  const cartOpen = useAppStore((s) => s.cartOpen);
  const setCartOpen = useAppStore((s) => s.setCartOpen);
  const executing = useAppStore((s) => s.executing);
  const error = useAppStore((s) => s.orderExecutionError);
  const dismissError = useAppStore((s) => s.dismissOrderExecutionError);
  const removeOrder = useAppStore((s) => s.removeStagedOrder);
  const clearOrders = useAppStore((s) => s.clearStagedOrders);
  const scenario = useAppStore((s) => s.scenario);
  const select = useAppStore((s) => s.select);
  const lastResult = useAppStore((s) => s.lastExecutionResult);
  const roundReady = useAppStore((s) => s.roundReady);
  const setRoundReady = useAppStore((s) => s.setRoundReady);
  const executeRound = useAppStore((s) => s.executeRound);

  const meReady = roundReady[playerTeam];
  const otherTeam: typeof playerTeam = playerTeam === "blue" ? "red" : "blue";
  const otherReady = roundReady[otherTeam];
  const bothReady = meReady && otherReady;

  const unitsById = useMemo(() => {
    const m = new Map<string, Unit>();
    if (!scenario) return m;
    for (const u of scenario.units) m.set(u.id, u);
    return m;
  }, [scenario]);

  const factionsById = useMemo(() => {
    const m = new Map<string, Faction>();
    if (!scenario) return m;
    for (const f of scenario.factions) m.set(f.id, f);
    return m;
  }, [scenario]);

  const showLastResult = !!lastResult && Date.now() - lastResult.at < 12000;

  if (
    orders.length === 0 &&
    !cartOpen &&
    !error &&
    !showLastResult &&
    !meReady &&
    !otherReady
  )
    return null;

  const teamColor = playerTeam === "blue" ? "text-faction-nato" : "text-faction-ru";
  const teamBorder = playerTeam === "blue" ? "border-faction-nato/60" : "border-faction-ru/60";
  const teamDot = playerTeam === "blue" ? "bg-faction-nato" : "bg-faction-ru";

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[60] flex w-80 flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setCartOpen(!cartOpen)}
        aria-expanded={cartOpen}
        className={`pointer-events-auto inline-flex items-center gap-2 hairline border ${teamBorder} bg-ink-800/95 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider2 shadow-lg transition-colors hover:bg-ink-700`}
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${teamDot}`} />
        <span className={teamColor}>orders</span>
        <span className="text-ink-100">·</span>
        <span className="text-ink-50">{orders.length}</span>
        <span className="text-ink-300">{cartOpen ? "▾" : "▸"}</span>
      </button>

      {cartOpen && (
        <div className="pointer-events-auto w-full hairline border bg-ink-800/95 shadow-xl">
          <div className={`hairline-b flex items-center justify-between px-3 py-2 ${teamColor}`}>
            <span className="font-mono text-[10px] uppercase tracking-wider2">
              staged · {playerTeam} team
            </span>
            <button
              type="button"
              onClick={() => setCartOpen(false)}
              aria-label="Close orders"
              className="font-mono text-[12px] text-ink-200 hover:text-ink-50"
            >
              ×
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
              {meReady
                ? "ready with no orders. waiting for other team."
                : "no orders staged. plan a unit move or strike."}
            </div>
          ) : (
            <ul className="max-h-[40vh] overflow-y-auto">
              {orders.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  unitsById={unitsById}
                  factionsById={factionsById}
                  onSelect={() => onSelectOrder(o, select)}
                  onRemove={() => removeOrder(o.id)}
                  disabled={executing || meReady}
                />
              ))}
            </ul>
          )}

          {error && (
            <div className="hairline-t flex items-start gap-2 bg-accent-danger/10 px-3 py-2">
              <p className="flex-1 font-mono text-[10px] uppercase tracking-wider2 text-accent-danger whitespace-pre-line">
                {error}
              </p>
              <button
                type="button"
                onClick={dismissError}
                aria-label="Dismiss error"
                className="font-mono text-[11px] text-accent-danger hover:text-ink-50"
              >
                ×
              </button>
            </div>
          )}

          <div className="hairline-t flex flex-col gap-2 px-3 py-2">
            <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider2 text-ink-200">
              <span>
                you · {meReady ? <span className="text-accent-ok">ready</span> : <span className="text-ink-100">planning</span>}
              </span>
              <span>
                {otherTeam} · {otherReady ? <span className="text-accent-ok">ready</span> : <span className="text-ink-100">planning</span>}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={executing || meReady || orders.length === 0}
                onClick={() => clearOrders(playerTeam)}
                className="hairline border border-ink-500 px-2 py-1 font-mono text-[9px] uppercase tracking-wider2 text-ink-200 transition-colors hover:border-ink-300 hover:text-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear
              </button>

              {bothReady ? (
                <button
                  type="button"
                  disabled={executing}
                  onClick={() => void executeRound()}
                  className="hairline border border-accent-ok bg-accent-ok/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider2 text-accent-ok transition-colors hover:bg-accent-ok/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent-ok/10"
                >
                  {executing ? "Executing round…" : "Execute round"}
                </button>
              ) : meReady ? (
                <button
                  type="button"
                  disabled={executing}
                  onClick={() => setRoundReady(playerTeam, false)}
                  className="hairline border border-ink-300 px-3 py-1 font-mono text-[10px] uppercase tracking-wider2 text-ink-100 transition-colors hover:border-ink-50 hover:text-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Unready
                </button>
              ) : (
                <button
                  type="button"
                  disabled={executing}
                  onClick={() => setRoundReady(playerTeam, true)}
                  className="hairline border border-accent-ok bg-accent-ok/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider2 text-accent-ok transition-colors hover:bg-accent-ok/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent-ok/10"
                >
                  {orders.length === 0 ? "Ready (pass turn)" : `Ready (${orders.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showLastResult && lastResult && (
        <ExecutionDigest
          outcomes={lastResult.outcomes}
          political={lastResult.political_summary}
        />
      )}
    </div>
  );
}

function onSelectOrder(o: StagedOrder, select: (s: { kind: "unit"; id: string } | null) => void) {
  switch (o.kind) {
    case "move":
    case "entrench":
    case "rebase_air":
    case "air_sortie":
    case "naval_move":
    case "naval_strike":
    case "resupply":
      return select({ kind: "unit", id: o.unitId });
    case "engage":
      return select({ kind: "unit", id: o.attackerId });
    case "missile_strike":
    case "interdict_supply":
      return;
  }
}

interface OrderRowProps {
  order: StagedOrder;
  unitsById: Map<string, Unit>;
  factionsById: Map<string, Faction>;
  onSelect: () => void;
  onRemove: () => void;
  disabled: boolean;
}

function OrderRow({ order, unitsById, factionsById, onSelect, onRemove, disabled }: OrderRowProps) {
  const accent = factionAccent(order, unitsById, factionsById);
  const { title, subtitle } = orderRowSummary(order);
  const isLlm = order.source === "llm";
  return (
    <li className="hairline-b last:border-b-0 flex items-start gap-2 px-3 py-2">
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 text-left"
        title="Show on the map"
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 shrink-0"
            style={{ backgroundColor: accent }}
          />
          {isLlm && (
            <span
              className="hairline border border-accent-ok bg-accent-ok/10 px-1 py-px font-mono text-[8px] uppercase tracking-wider2 text-accent-ok"
              title="Suggested by the assistant"
            >
              AI
            </span>
          )}
          <span className="text-[12px] font-semibold text-ink-50 truncate">{title}</span>
        </div>
        <div className="mt-0.5 flex items-baseline gap-2 font-mono text-[9px] uppercase tracking-wider2 text-ink-200">
          {subtitle}
        </div>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label="Remove order"
        className="shrink-0 hairline border border-ink-500 px-1.5 py-0.5 font-mono text-[11px] text-ink-200 transition-colors hover:border-accent-danger hover:text-accent-danger disabled:cursor-not-allowed disabled:opacity-40"
      >
        ×
      </button>
    </li>
  );
}

function factionAccent(
  o: StagedOrder,
  unitsById: Map<string, Unit>,
  factionsById: Map<string, Faction>,
): string {
  let unitId: string | null = null;
  switch (o.kind) {
    case "move":
    case "entrench":
    case "rebase_air":
    case "air_sortie":
    case "naval_move":
    case "naval_strike":
    case "resupply":
      unitId = o.unitId;
      break;
    case "engage":
      unitId = o.attackerId;
      break;
    case "missile_strike":
    case "interdict_supply":
      return "#888";
  }
  const unit = unitId ? unitsById.get(unitId) : undefined;
  if (!unit) return "#888";
  const faction = factionsById.get(unit.faction_id);
  return faction?.color ?? "#888";
}

interface RowSummary {
  title: string;
  subtitle: React.ReactNode;
}

function orderRowSummary(o: StagedOrder): RowSummary {
  switch (o.kind) {
    case "move":
      return {
        title: o.unitId,
        subtitle: (
          <>
            <span>move · {o.mode}</span>
            <span className="text-ink-300">·</span>
            <span>{haversineKm(o.origin, o.destination).toFixed(1)} km</span>
          </>
        ),
      };
    case "entrench":
      return {
        title: o.unitName || o.unitId,
        subtitle: <span>entrench · raise defence</span>,
      };
    case "engage":
      return {
        title: `${o.attackerName} → ${o.targetName}`,
        subtitle: (
          <>
            <span>engage</span>
            <span className="text-ink-300">·</span>
            <span>{o.rangeKm.toFixed(1)} km</span>
          </>
        ),
      };
    case "rebase_air":
      return {
        title: o.unitName,
        subtitle: (
          <>
            <span>rebase</span>
            <span className="text-ink-300">·</span>
            <span>→ {o.airfieldName}</span>
          </>
        ),
      };
    case "air_sortie":
      return {
        title: `${o.unitName} → ${o.targetName}`,
        subtitle: (
          <>
            <span>sortie · {o.mission}</span>
            <span className="text-ink-300">·</span>
            <span>{haversineKm(o.origin, o.targetPos).toFixed(0)} km</span>
          </>
        ),
      };
    case "naval_move":
      return {
        title: o.unitName,
        subtitle: (
          <>
            <span>naval move</span>
            <span className="text-ink-300">·</span>
            <span>{haversineKm(o.origin, o.destination).toFixed(0)} km</span>
          </>
        ),
      };
    case "naval_strike":
      return {
        title: `${o.unitName} → ${o.targetName}`,
        subtitle: (
          <>
            <span>naval strike</span>
            <span className="text-ink-300">·</span>
            <span>{haversineKm(o.origin, o.targetPos).toFixed(0)} km</span>
          </>
        ),
      };
    case "missile_strike":
      return {
        title: `${o.platformName} → ${o.targetName}`,
        subtitle: (
          <>
            <span>missile strike</span>
            <span className="text-ink-300">·</span>
            <span>{haversineKm(o.origin, o.targetPos).toFixed(0)} km</span>
          </>
        ),
      };
    case "resupply":
      return {
        title: `${o.depotName} → ${o.unitName}`,
        subtitle: <span>resupply · raise readiness</span>,
      };
    case "interdict_supply":
      return {
        title: `${o.platformName} → ${o.supplyLineName}`,
        subtitle: (
          <>
            <span>interdict</span>
            <span className="text-ink-300">·</span>
            <span>{haversineKm(o.origin, o.targetPos).toFixed(0)} km</span>
          </>
        ),
      };
  }
}

interface DigestProps {
  outcomes: import("@/types/orders").OrderOutcomeDTO[];
  political: Record<string, Record<string, number>>;
}

/** A short summary that appears for ~12s after a successful execute. */
function ExecutionDigest({ outcomes, political }: DigestProps) {
  const combat = outcomes.filter(
    (o) => o.kind === "engage" || o.kind === "air_sortie" || o.kind === "missile_strike"
      || o.kind === "naval_strike" || o.kind === "interdict_supply",
  );
  const polEntries = Object.entries(political);
  return (
    <div className="pointer-events-auto w-full hairline border border-ink-500 bg-ink-800/95 p-2 shadow-xl">
      <div className="font-mono text-[9px] uppercase tracking-wider2 text-ink-200">
        last execute
      </div>
      {combat.length === 0 && polEntries.length === 0 && (
        <div className="font-mono text-[10px] text-ink-100">no kinetic effects</div>
      )}
      {combat.slice(0, 3).map((o) => (
        <div key={o.order_id} className="font-mono text-[10px] text-ink-100">
          · {o.kind} · {summariseOutcome(o)}
        </div>
      ))}
      {polEntries.length > 0 && (
        <div className="mt-1 font-mono text-[9px] uppercase tracking-wider2 text-ink-200">
          political:
        </div>
      )}
      {polEntries.slice(0, 4).map(([country, deltas]) => (
        <div key={country} className="font-mono text-[10px] text-ink-100">
          · {country}: {Object.entries(deltas)
            .map(([k, v]) => `${k}${v >= 0 ? "+" : ""}${v.toFixed(2)}`)
            .join(" ")}
        </div>
      ))}
    </div>
  );
}

function summariseOutcome(o: import("@/types/orders").OrderOutcomeDTO): string {
  const d = o.details as Record<string, unknown>;
  if (o.kind === "engage") {
    const a = d.attacker_strength_loss as number | undefined;
    const def = d.defender_strength_loss as number | undefined;
    const ret = d.defender_retreated as boolean | undefined;
    return `A-${a?.toFixed(2)}/D-${def?.toFixed(2)}${ret ? " ·retreat" : ""}`;
  }
  if (d.intercepted) return `intercepted`;
  if (d.hit) return `hit dmg=${(d.damage as number)?.toFixed(2)}`;
  return `miss`;
}
