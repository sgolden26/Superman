export interface HeadsUpStatusProps {
  online: boolean;
  batteryPercent?: number | null;
  gpsAccuracyMetres?: number | null;
  lastSyncIso?: string | null;
}

/** Slim status bar: connectivity, GPS quality, battery, last data sync. */
export default function HeadsUpStatus(_props: HeadsUpStatusProps) {
  return <div data-component="HeadsUpStatus" />;
}
