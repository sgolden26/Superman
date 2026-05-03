import { useEffect, useState } from "react";
import { useAppStore } from "@/state/store";
import { subscribeMap } from "@/map/mapRef";
import type { SpawnPulse } from "@/state/store";

/** Transient theatrical overlay for entities the LLM just spawned.
 *
 *  Each pulse renders an expanding ring + a "DEPLOYED" label anchored to
 *  the new entity's lon/lat. Auto-evicts itself from the store after the
 *  CSS animation finishes so old pulses don't leak. Anchored using the
 *  same `subscribeMap` + `map.project()` pattern as `DamageChips`.
 */
export function SpawnPulses() {
  const pulses = useAppStore((s) => s.assistantSpawnPulses);

  if (pulses.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {pulses.map((p) => (
        <Pulse key={p.id} pulse={p} />
      ))}
    </div>
  );
}

const PULSE_LIFETIME_MS = 2600;

function Pulse({ pulse }: { pulse: SpawnPulse }) {
  const dismiss = useAppStore((s) => s.dismissSpawnPulse);
  const [pos, setPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    return subscribeMap((m) => {
      if (!m) {
        setPos(null);
        return;
      }
      const update = () => {
        const p = m.project(pulse.position);
        setPos([p.x, p.y]);
      };
      update();
      m.on("move", update);
      m.on("zoom", update);
      m.on("rotate", update);
      m.on("pitch", update);
      m.on("resize", update);
      return () => {
        m.off("move", update);
        m.off("zoom", update);
        m.off("rotate", update);
        m.off("pitch", update);
        m.off("resize", update);
      };
    });
  }, [pulse.position]);

  useEffect(() => {
    const elapsed = Date.now() - pulse.at;
    const remaining = Math.max(0, PULSE_LIFETIME_MS - elapsed);
    const timer = window.setTimeout(() => dismiss(pulse.id), remaining);
    return () => window.clearTimeout(timer);
  }, [pulse.id, pulse.at, dismiss]);

  if (!pos) return null;

  const colour = pulse.team === "blue" ? "#5aa9ff" : "#ff5a5a";
  const kindLabel = pulse.kind === "missile_range" ? "platform" : "unit";

  return (
    <div style={{ position: "absolute", left: pos[0], top: pos[1] }}>
      <span
        aria-hidden
        className="absolute h-12 w-12 animate-spawnRing rounded-full"
        style={{
          left: 0,
          top: 0,
          border: `1.5px solid ${colour}`,
          boxShadow: `0 0 18px ${colour}55, inset 0 0 12px ${colour}33`,
        }}
      />
      <span
        aria-hidden
        className="absolute h-3 w-3 rounded-full"
        style={{
          left: 0,
          top: 0,
          transform: "translate(-50%, -50%)",
          background: colour,
          boxShadow: `0 0 10px ${colour}aa`,
        }}
      />
      <div
        className="absolute animate-spawnLabel rounded-sm border bg-ink-900/85 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider2 shadow-md"
        style={{
          left: 0,
          top: 0,
          borderColor: colour,
          color: colour,
          whiteSpace: "nowrap",
        }}
      >
        <span className="opacity-70">deployed {kindLabel} ·</span>{" "}
        <span className="text-ink-50">{pulse.name}</span>
      </div>
    </div>
  );
}
