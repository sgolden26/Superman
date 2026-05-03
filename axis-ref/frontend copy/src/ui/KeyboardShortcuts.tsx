import { useEffect } from "react";
import { useAppStore } from "@/state/store";
import { getMapInstance } from "@/map/mapRef";

export function KeyboardShortcuts() {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }

      const s = useAppStore.getState();
      switch (ev.key) {
        case "[":
          s.setLeftDockOpen(!s.leftDockOpen);
          break;
        case "]":
          s.setRightPanelOpen(!s.rightPanelOpen);
          break;
        case "Escape":
          if (s.decisionImmersiveOpen) s.setDecisionImmersiveOpen(false);
          else if (s.measureActive) s.setMeasureActive(false);
          else if (s.selection) s.clearSelection();
          else if (s.showHelp) s.setShowHelp(false);
          break;
        case "m":
        case "M":
          s.setMeasureActive(!s.measureActive);
          break;
        case "b":
        case "B": {
          const map = getMapInstance();
          if (!map) break;
          const center = map.getCenter();
          const id = `bm-${Date.now().toString(36)}`;
          const label = window.prompt(
            "Bookmark label",
            `view ${s.bookmarks.length + 1}`,
          );
          if (!label) break;
          s.addBookmark({
            id,
            label,
            center: [center.lng, center.lat],
            zoom: map.getZoom(),
            pitch: map.getPitch(),
            bearing: map.getBearing(),
          });
          break;
        }
        case "?":
          s.setShowHelp(!s.showHelp);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showHelp = useAppStore((s) => s.showHelp);
  const setShowHelp = useAppStore((s) => s.setShowHelp);

  if (!showHelp) return null;
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-ink-900/70">
      <div className="hairline border border-ink-500 bg-ink-800 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
            keyboard shortcuts
          </span>
          <button
            onClick={() => setShowHelp(false)}
            className="font-mono text-[10px] text-ink-200 hover:text-ink-50"
          >
            ×
          </button>
        </div>
        <table className="font-mono text-[11px] text-ink-100">
          <tbody>
            {[
              ["[", "Toggle left dock"],
              ["]", "Toggle right panel"],
              ["M", "Measure tool"],
              ["B", "Bookmark current view"],
              ["Esc", "Close decision workspace / measure / clear selection"],
              ["?", "This help"],
            ].map(([k, v]) => (
              <tr key={k}>
                <td className="pr-4 text-ink-200">{k}</td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
