import { useAppStore } from "@/state/store";
import { getMapInstance } from "@/map/mapRef";

export function Bookmarks() {
  const bookmarks = useAppStore((s) => s.bookmarks);
  const add = useAppStore((s) => s.addBookmark);
  const remove = useAppStore((s) => s.removeBookmark);

  const onAdd = () => {
    const map = getMapInstance();
    if (!map) return;
    const center = map.getCenter();
    const id = `bm-${Date.now().toString(36)}`;
    const label = window.prompt("Bookmark label", `view ${bookmarks.length + 1}`);
    if (!label) return;
    add({
      id,
      label,
      center: [center.lng, center.lat],
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
    });
  };

  const onJump = (b: (typeof bookmarks)[number]) => {
    const map = getMapInstance();
    if (!map) return;
    map.easeTo({
      center: b.center,
      zoom: b.zoom,
      pitch: b.pitch ?? 0,
      bearing: b.bearing ?? 0,
      duration: 500,
    });
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <button
        onClick={onAdd}
        className="border border-ink-600 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider2 text-ink-200 hover:border-ink-400 hover:text-ink-50"
        title="Bookmark current view ( B )"
      >
        ★ save view
      </button>
      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        {bookmarks.length === 0 ? (
          <span className="font-mono text-[10px] text-ink-300">no bookmarks</span>
        ) : (
          bookmarks.map((b) => (
            <div
              key={b.id}
              className="group flex items-center gap-1 border border-ink-600 px-1.5 py-0.5"
            >
              <button
                onClick={() => onJump(b)}
                className="font-mono text-[10px] uppercase tracking-wider2 text-ink-100 hover:text-ink-50"
                title={`Jump to ${b.label}`}
              >
                {b.label}
              </button>
              <button
                onClick={() => remove(b.id)}
                className="font-mono text-[10px] text-ink-300 hover:text-accent-danger"
                title="Remove"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
