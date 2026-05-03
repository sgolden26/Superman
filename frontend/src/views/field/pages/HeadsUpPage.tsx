import HudLensFrame from '../components/HudLensFrame';

/**
 * The default field view: the wearer's perspective through the IVAS visor.
 * For now only the lens frame is rendered; tactical overlays (compass,
 * waypoints, squad markers, threat icons) will be layered inside the lens
 * area in subsequent work.
 */
export default function HeadsUpPage() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <HudLensFrame />
    </div>
  );
}
