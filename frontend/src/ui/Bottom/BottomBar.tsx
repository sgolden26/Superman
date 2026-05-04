import { useAppStore } from "@/state/store";
import { SessionControls } from "@/ui/SessionControls";
import { Bookmarks } from "./Bookmarks";
import { MeasureTool } from "./MeasureTool";
import { EventTicker } from "./EventTicker";

export function BottomBar() {
  const decisionImmersive = useAppStore((s) => s.decisionImmersiveOpen);
  if (decisionImmersive) {
    return <EventTicker thin />;
  }
  return (
    <div className="hairline-t panel-surface flex flex-col">
      <div className="hairline-b flex flex-wrap items-center divide-x divide-[var(--hairline)]">
        <SessionControls />
        <MeasureTool />
        <Bookmarks />
      </div>
      <EventTicker />
    </div>
  );
}
