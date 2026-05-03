import Card from '@/components/ui/Card';
import { useSensors } from '@/hooks/useSensors';
import type { Sensor } from '@/types/sensor';

/** Sensor inventory: identity, name, location. */
export default function SensorsPage() {
  const { data, error, isLoading } = useSensors();

  return (
    <div className="space-y-3 p-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-slate-100">Sensors</h2>
        <span className="text-xs text-slate-500">
          {isLoading && data === null ? 'Loading…' : `${data?.length ?? 0} sensor(s)`}
        </span>
      </header>

      {error ? (
        <Card className="border-red-900/60 bg-red-950/40 text-sm text-red-200">
          {error.message}
        </Card>
      ) : null}

      {data && data.length === 0 ? (
        <Card className="text-sm text-slate-400">
          No sensors yet. Wire a data source in <code>SensorRepository.list</code>.
        </Card>
      ) : null}

      {data && data.length > 0 ? (
        <ul className="space-y-2">
          {data.map((sensor) => (
            <SensorRow key={sensor.id} sensor={sensor} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SensorRow({ sensor }: { sensor: Sensor }) {
  return (
    <li>
      <Card className="flex items-center justify-between gap-4 text-sm">
        <div>
          <div className="font-medium text-slate-100">{sensor.name}</div>
          <div className="text-xs text-slate-500">{sensor.id}</div>
        </div>
        <div className="font-mono text-xs text-slate-300">
          {sensor.location.lat.toFixed(4)}, {sensor.location.lon.toFixed(4)}
        </div>
      </Card>
    </li>
  );
}
