import { useAppStore } from "@/state/store";
import { Bookmarks } from "./Bookmarks";
import { MeasureTool } from "./MeasureTool";
import { EventTicker } from "./EventTicker";

export function BottomBar() {
  const decisionImmersive = useAppStore((s) => s.decisionImmersiveOpen);
  if (decisionImmersive) {
    return <EventTicker thin />;
  }
  return (
    <div className="seam-t deck-surface flex flex-col">
      <div className="seam-b flex items-center divide-x divide-[var(--seam)]">
        <MeasureTool />
        <Bookmarks />
      </div>
      <EventTicker />
    </div>
  );
}
