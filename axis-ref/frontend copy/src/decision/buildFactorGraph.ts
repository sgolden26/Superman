import type { Action } from "@/types/decision";
import type { Driver, RegionIntel } from "@/types/intel";

export type FlowNodeKind = "signal" | "factor" | "morale" | "action";

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  label: string;
  sublabel?: string;
  /** 0..1 for bar hint on actions */
  weightHint?: number;
  /** contribution for factors */
  contribution?: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type EdgeStyle = "informs" | "drives" | "ambient" | "choice";

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  style: EdgeStyle;
  label?: string;
}

const VB_W = 1000;
const VB_H = 340;

/**
 * Lays out a notional "intel fusion" graph from the existing RegionIntel
 * snapshot: signals (recent news) → factor drivers → regional morale
 * → courses of action. Purely client-side; helps wargamers see what feeds what.
 */
export function buildFactorGraph(
  region: RegionIntel,
  actions: Action[],
  territoryName: string,
): { nodes: FlowNode[]; edges: FlowEdge[]; viewW: number; viewH: number } {
  const signals = region.recent_events.slice(0, 3);
  const factors: Driver[] = region.drivers.slice(0, 4);

  const signalNodes: FlowNode[] = signals.map((e, i) => ({
    id: `sig-${e.id}`,
    kind: "signal",
    label: e.headline,
    sublabel: e.source,
    x: 20,
    y: 24 + i * 88,
    w: 220,
    h: 76,
  }));

  const factorNodes: FlowNode[] = factors.map((d, i) => ({
    id: `fac-${d.event_id}`,
    kind: "factor",
    label: d.headline,
    sublabel: d.category,
    contribution: d.contribution,
    x: 272,
    y: 24 + i * 76,
    w: 232,
    h: 68,
  }));

  const morale: FlowNode = {
    id: "morale",
    kind: "morale",
    label: "Regional morale",
    sublabel: territoryName,
    weightHint: region.morale_score / 100,
    x: 524,
    y: 88,
    w: 160,
    h: 120,
  };

  const actionCount = Math.min(4, actions.length);
  const actionNodes: FlowNode[] = actions.slice(0, actionCount).map((a, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    return {
      id: `act-${a.id}`,
      kind: "action" as const,
      label: a.name,
      sublabel: a.id,
      x: 700 + col * 132,
      y: 32 + row * 112,
      w: 124,
      h: 88,
    };
  });

  const nodes = [...signalNodes, ...factorNodes, morale, ...actionNodes];
  const edges: FlowEdge[] = [];

  const eventById = new Map(signals.map((e) => [e.id, e]));

  for (const f of factors) {
    if (eventById.has(f.event_id)) {
      edges.push({
        id: `e-sig-${f.event_id}`,
        from: `sig-${f.event_id}`,
        to: `fac-${f.event_id}`,
        style: "informs",
        label: "curated link",
      });
    } else {
      for (const e of signals) {
        if (e.category === f.category) {
          edges.push({
            id: `e-weak-${e.id}-${f.event_id}`,
            from: `sig-${e.id}`,
            to: `fac-${f.event_id}`,
            style: "ambient",
            label: "class match",
          });
          break;
        }
      }
    }
    edges.push({
      id: `e-m-${f.event_id}`,
      from: `fac-${f.event_id}`,
      to: "morale",
      style: "drives",
    });
  }

  for (const s of signalNodes) {
    if (factors.length === 0) {
      edges.push({ id: `e-s-${s.id}-m`, from: s.id, to: "morale", style: "ambient" });
    }
  }

  for (const an of actionNodes) {
    const actionId = an.id.replace("act-", "");
    edges.push({
      id: `e-ch-${actionId}`,
      from: "morale",
      to: an.id,
      style: "choice",
    });
  }

  return { nodes, edges, viewW: VB_W, viewH: VB_H };
}
