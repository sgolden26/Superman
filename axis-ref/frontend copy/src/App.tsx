import { useEffect } from "react";
import { useAppStore } from "@/state/store";
import { loadScenario } from "@/api/loadScenario";
import { loadIntel } from "@/api/loadIntel";
import { HUD } from "@/ui/HUD";
import { PoliticalStrip } from "@/ui/PoliticalStrip";
import { LeftDock } from "@/ui/LeftDock/LeftDock";
import { RightPanel } from "@/ui/RightPanel/RightPanel";
import { MapView } from "@/map/MapView";
import { CountryRoster } from "@/ui/CountryRoster";
import { HoverCard } from "@/ui/HoverCard";
import { Minimap } from "@/ui/Bottom/Minimap";
import { BottomBar } from "@/ui/Bottom/BottomBar";
import { KeyboardShortcuts } from "@/ui/KeyboardShortcuts";
import { DecisionImmersive } from "@/ui/DecisionEngine/DecisionImmersive";
import { MoveLimitToast } from "@/ui/MoveLimitToast";
import { OrdersCart } from "@/ui/Orders/OrdersCart";
import { AssistantBar } from "@/ui/Assistant/AssistantBar";
import { SpawnPulses } from "@/ui/Assistant/SpawnPulses";
import { ArticleDrawer } from "@/ui/Article/ArticleDrawer";
import { PhasePill } from "@/ui/Replay/PhasePill";
import { DamageChips } from "@/ui/Replay/DamageChips";

export function App() {
  const setScenario = useAppStore((s) => s.setScenario);
  const setLoadError = useAppStore((s) => s.setLoadError);
  const setIntel = useAppStore((s) => s.setIntel);
  const setIntelError = useAppStore((s) => s.setIntelError);
  const intelTickIntervalMs = useAppStore((s) => s.intelTickIntervalMs);
  const loadError = useAppStore((s) => s.loadError);
  const scenario = useAppStore((s) => s.scenario);

  useEffect(() => {
    loadScenario()
      .then(setScenario)
      .catch((err: Error) => setLoadError(err.message));
  }, [setScenario, setLoadError]);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const snap = await loadIntel();
        if (!cancelled) setIntel(snap);
      } catch (err) {
        if (!cancelled) {
          setIntelError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    void tick();
    const id = window.setInterval(tick, intelTickIntervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [setIntel, setIntelError, intelTickIntervalMs]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ink-900 text-ink-50">
      <HUD />
      <PoliticalStrip />
      <div className="relative flex flex-1 overflow-hidden">
        <LeftDock />
        <main className="relative flex-1 overflow-hidden">
          <MapView />
          <DamageChips />
          <SpawnPulses />
          <PhasePill />
          <OrdersCart />
          <AssistantBar />
          <CountryRoster />
          <Minimap />
          <HoverCard />
          <KeyboardShortcuts />
          <MoveLimitToast />
          {!scenario && !loadError && <LoadingOverlay />}
          {loadError && <ErrorOverlay message={loadError} />}
        </main>
        <RightPanel />
        <ArticleDrawer />
      </div>
      <BottomBar />
      <DecisionImmersive />
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="hairline border bg-ink-800/80 px-4 py-2 font-mono text-[10px] uppercase tracking-wider2 text-ink-100">
        loading theatre...
      </div>
    </div>
  );
}

function ErrorOverlay({ message }: { message: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="hairline max-w-md border bg-ink-800/90 px-4 py-3 font-mono text-[11px] uppercase tracking-wider2 text-accent-danger">
        <div className="mb-1">scenario load failed</div>
        <div className="text-ink-100 normal-case">{message}</div>
        <div className="mt-2 text-ink-200 normal-case">
          run the backend exporter:
          <br />
          <span className="text-ink-50">
            cd backend &amp;&amp; python -m axis export --out ../data/state.json
          </span>
        </div>
      </div>
    </div>
  );
}
