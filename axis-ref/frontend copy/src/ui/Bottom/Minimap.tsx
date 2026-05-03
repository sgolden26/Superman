import { useEffect, useRef } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import { baseStyle } from "@/map/style";
import { getMapInstance, subscribeMap } from "@/map/mapRef";
import { useAppStore } from "@/state/store";

interface MinimapProps {
  /** Replaces the default lower-right slot when set. */
  className?: string;
  /** Second minimap (PIP) in decision workspace; main minimap is hidden while immersive. */
  variant?: "default" | "pip";
}

export function Minimap({ className, variant = "default" }: MinimapProps) {
  const decisionImmersive = useAppStore((s) => s.decisionImmersiveOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<MlMap | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  /** Must not return before hooks — only main minimap hides while decision workspace is open. */
  const skipDefault = variant === "default" && decisionImmersive;

  useEffect(() => {
    if (skipDefault) {
      if (miniRef.current) {
        miniRef.current.remove();
        miniRef.current = null;
      }
      return;
    }
    if (!containerRef.current || miniRef.current) return;
    const mini = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle,
      center: [33.0, 48.5],
      zoom: 2.6,
      interactive: false,
      attributionControl: false,
    });
    miniRef.current = mini;
    return () => {
      mini.remove();
      miniRef.current = null;
    };
  }, [skipDefault]);

  useEffect(() => {
    if (skipDefault) return;

    let main: MlMap | null = null;

    const onMove = () => {
      if (!main || !miniRef.current || !boxRef.current) return;
      const bounds = main.getBounds();
      const sw = miniRef.current.project([bounds.getWest(), bounds.getSouth()]);
      const ne = miniRef.current.project([bounds.getEast(), bounds.getNorth()]);
      const left = Math.min(sw.x, ne.x);
      const top = Math.min(sw.y, ne.y);
      const width = Math.abs(ne.x - sw.x);
      const height = Math.abs(ne.y - sw.y);
      const box = boxRef.current;
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
    };

    const unsub = subscribeMap((m) => {
      if (main) {
        main.off("move", onMove);
        main.off("zoom", onMove);
      }
      main = m;
      if (m) {
        m.on("move", onMove);
        m.on("zoom", onMove);
        const apply = () => onMove();
        if (m.loaded()) apply();
        else m.once("load", apply);
      }
    });
    return () => {
      unsub();
      if (main) {
        main.off("move", onMove);
        main.off("zoom", onMove);
      }
    };
  }, [skipDefault]);

  const onClick = (ev: React.MouseEvent<HTMLDivElement>) => {
    if (!miniRef.current) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const lngLat = miniRef.current.unproject([x, y]);
    const main = getMapInstance();
    if (main) main.easeTo({ center: [lngLat.lng, lngLat.lat], duration: 300 });
  };

  const shell =
    className ??
    (variant === "pip"
      ? "relative h-40 w-56 overflow-hidden border border-[var(--hairline-strong)] bg-ink-900/90 shadow-xl"
      : "absolute bottom-12 right-3 h-32 w-48 overflow-hidden border border-[var(--hairline-strong)] bg-ink-900/90 shadow-xl");

  if (skipDefault) return null;

  return (
    <div className={shell}>
      <div ref={containerRef} className="absolute inset-0" />
      <div
        ref={boxRef}
        className="pointer-events-none absolute border border-ink-50/60"
        style={{ background: "rgba(90,169,255,0.08)" }}
      />
      <div
        onClick={onClick}
        className="absolute inset-0 cursor-crosshair"
        title="Click to recenter"
      />
      <div className="absolute bottom-0 left-0 right-0 border-t border-[var(--hairline)] bg-ink-900/85 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider2 text-ink-300 backdrop-blur-sm">
        minimap
      </div>
    </div>
  );
}
