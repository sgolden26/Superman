import { useCallback, useEffect, useRef, useState } from "react";
import type { Feature, Geometry, Polygon } from "geojson";
import maplibregl, { type Map as MlMap } from "maplibre-gl";
import { loadBorders } from "@/api/loadBorders";
import { baseStyle } from "@/map/style";
import { getMapInstance, subscribeMap } from "@/map/mapRef";
import { useAppStore } from "@/state/store";
import {
  resolveRegionEntity,
  type ResolvedRegionEntity,
} from "@/decision/resolveRegionEntity";

const SOURCE = "decision-pip-focus";
const LAYER = "decision-pip-focus-line";
const DEFAULT_TOP = 64;
const DEFAULT_RIGHT = 16;

function extendBounds(geom: Geometry, b: maplibregl.LngLatBounds): void {
  const addRing = (ring: [number, number][]) => {
    for (const c of ring) b.extend(c as [number, number]);
  };
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates) addRing(ring as [number, number][]);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) {
      for (const ring of poly) addRing(ring as [number, number][]);
    }
  } else if (geom.type === "LineString") {
    addRing(geom.coordinates as [number, number][]);
  }
}

function lineFeatureFromFocus(
  id: string,
  feature: ResolvedRegionEntity,
  admin1: { features: { properties?: { iso_3166_2: string } | null; geometry: Geometry }[] },
): Feature<Geometry, { id: string }> | null {
  if (feature.territory) {
    return {
      type: "Feature",
      properties: { id },
      geometry: { type: "Polygon", coordinates: feature.territory.polygon } as Polygon,
    };
  }
  if (feature.oblast) {
    const g = admin1.features.find(
      (f) => f.properties && f.properties.iso_3166_2 === feature.oblast?.iso_3166_2,
    );
    if (g) {
      return {
        type: "Feature",
        properties: { id },
        geometry: g.geometry,
      };
    }
  }
  return null;
}

/**
 * Inset map for the decision workspace: main-map viewport (box) + outline of the focused oblast/territory.
 * Draggable by the top handle so it can be moved off UI.
 */
export function DecisionPipMap({ regionId }: { regionId: string | null }) {
  const scenario = useAppStore((s) => s.scenario);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{
    el: HTMLDivElement;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const syncViewportBox = useCallback(() => {
    const m = mapRef.current;
    const main = getMapInstance();
    const box = boxRef.current;
    if (!m || !main || !box) return;
    const bounds = main.getBounds();
    const sw = m.project([bounds.getWest(), bounds.getSouth()]);
    const ne = m.project([bounds.getEast(), bounds.getNorth()]);
    const left = Math.min(sw.x, ne.x);
    const top = Math.min(sw.y, ne.y);
    const width = Math.abs(ne.x - sw.x);
    const height = Math.abs(ne.y - sw.y);
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
  }, []);

  const onPointerDownHandle = (e: React.PointerEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    e.preventDefault();
    const rect = wrap.getBoundingClientRect();
    const origX = pos ? pos.x : window.innerWidth - rect.width - DEFAULT_RIGHT;
    const origY = pos ? pos.y : DEFAULT_TOP;
    wrap.setPointerCapture(e.pointerId);
    drag.current = { el: wrap, startX: e.clientX, startY: e.clientY, origX, origY };
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return;
      const { el, startX, startY, origX, origY } = drag.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      let nx = origX + dx;
      let ny = origY + dy;
      nx = Math.max(4, Math.min(nx, window.innerWidth - w - 4));
      ny = Math.max(4, Math.min(ny, window.innerHeight - h - 4));
      setPos({ x: nx, y: ny });
    };
    const onUp = (e: PointerEvent) => {
      if (drag.current?.el.hasPointerCapture(e.pointerId)) {
        try {
          drag.current.el.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
      drag.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle,
      center: [32.0, 49.0],
      zoom: 5,
      interactive: false,
      attributionControl: false,
    });
    mapRef.current = map;
    const onMapLoad = () => {
      if (map.getSource(SOURCE)) return;
      map.addSource(SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: LAYER,
        type: "line",
        source: SOURCE,
        paint: {
          "line-color": "#c8e0ff",
          "line-width": 2.5,
          "line-opacity": 0.95,
        },
      });
    };
    if (map.loaded()) onMapLoad();
    else map.once("load", onMapLoad);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !scenario) return;
    let cancelled = false;

    const apply = async () => {
      const m = mapRef.current;
      if (!m || !scenario || cancelled) return;
      if (!m.getSource(SOURCE)) {
        m.once("load", () => void apply());
        return;
      }
      const src = m.getSource(SOURCE) as maplibregl.GeoJSONSource;
      if (!regionId) {
        src.setData({ type: "FeatureCollection", features: [] });
        m.easeTo({ center: [32, 49], zoom: 5, duration: 0 });
        window.requestAnimationFrame(syncViewportBox);
        return;
      }
      const ent = resolveRegionEntity(scenario, regionId);
      if (!ent) {
        src.setData({ type: "FeatureCollection", features: [] });
        return;
      }
      const borders = await loadBorders();
      if (cancelled) return;
      const feat = lineFeatureFromFocus(regionId, ent, borders.admin1Ua);
      if (!feat) {
        src.setData({ type: "FeatureCollection", features: [] });
        return;
      }
      src.setData({ type: "FeatureCollection", features: [feat] });
      const b = new maplibregl.LngLatBounds();
      extendBounds(feat.geometry, b);
      m.resize();
      m.fitBounds(b, { padding: 28, maxZoom: 8.5, duration: 0 });
      window.requestAnimationFrame(() => {
        if (!cancelled) syncViewportBox();
      });
    };

    if (map.getSource(SOURCE)) void apply();
    else map.once("load", () => void apply());
    return () => {
      cancelled = true;
    };
  }, [regionId, scenario, syncViewportBox]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    m.resize();
    const t = window.setTimeout(syncViewportBox, 60);
    return () => window.clearTimeout(t);
  }, [regionId, pos, syncViewportBox]);

  useEffect(() => {
    if (!mapRef.current) return;
    let main: MlMap | null = null;
    const onMove = () => syncViewportBox();
    const unsub = subscribeMap((ms) => {
      if (main) {
        main.off("move", onMove);
        main.off("zoom", onMove);
      }
      main = ms;
      if (ms) {
        ms.on("move", onMove);
        ms.on("zoom", onMove);
        if (ms.loaded()) onMove();
        else ms.once("load", onMove);
      } else onMove();
    });
    return () => {
      unsub();
      if (main) {
        main.off("move", onMove);
        main.off("zoom", onMove);
      }
    };
  }, [syncViewportBox]);

  const onPipClick = (ev: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const lngLat = mapRef.current.unproject([x, y]);
    const main = getMapInstance();
    if (main) main.easeTo({ center: [lngLat.lng, lngLat.lat], duration: 300 });
  };

  return (
    <div
      ref={wrapRef}
      className="hairline z-[200001] flex w-56 flex-col overflow-hidden border border-ink-500 bg-ink-900/90 shadow-glow"
      style={{
        position: "fixed",
        ...(pos
          ? { left: pos.x, top: pos.y }
          : { right: DEFAULT_RIGHT, top: DEFAULT_TOP }),
      }}
    >
      <button
        type="button"
        onPointerDown={onPointerDownHandle}
        className="shrink-0 cursor-grab border-b border-ink-600 bg-ink-800 px-2 py-1 text-left font-mono text-[8px] uppercase tracking-wider2 text-ink-200 active:cursor-grabbing"
        title="Drag to move"
      >
        · · · move
      </button>
      <div className="relative h-40 w-full">
        <div ref={containerRef} className="absolute inset-0" />
        <div
          ref={boxRef}
          className="pointer-events-none absolute border border-ink-50/50"
          style={{ background: "rgba(90,169,255,0.06)" }}
        />
        <div
          onClick={onPipClick}
          className="absolute inset-0 cursor-crosshair"
          title="Click to recenter main map"
        />
      </div>
      <div className="hairline-t bg-ink-900/80 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider2 text-ink-200">
        focus outline · white box = main view
      </div>
    </div>
  );
}
