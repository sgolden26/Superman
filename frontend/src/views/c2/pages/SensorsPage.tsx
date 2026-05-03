import type { ReactNode } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { Table, Td, Th } from '@/components/ui/Table';
import { useSensors } from '@/hooks/useSensors';
import type { Sensor } from '@/types/sensor';

export default function SensorsPage() {
  const { data, error, isLoading } = useSensors();
  const count = data?.length ?? 0;

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <PageHeader
        title="Sensors"
        description="Heartbeat sensors deployed across the operational area."
        meta={isLoading && data === null ? 'Loading' : `${count} active`}
      />
      <div className="min-h-0 flex-1 overflow-auto overscroll-none">
        {error ? <ErrorBanner message={error.message} /> : null}
        {data ? <SensorsTable rows={data} /> : null}
      </div>
    </div>
  );
}

function SensorsTable({ rows }: { rows: Sensor[] }) {
  if (rows.length === 0) {
    return <EmptyState>No sensors registered.</EmptyState>;
  }
  return (
    <Table>
      <colgroup>
        <col className="w-16" />
        <col />
        <col className="w-32" />
        <col className="w-32" />
      </colgroup>
      <thead>
        <tr>
          <Th align="right">ID</Th>
          <Th>Name</Th>
          <Th align="right">Lat</Th>
          <Th align="right">Lon</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.id} className="hover:bg-zinc-900/50">
            <Td align="right" mono className="text-zinc-500">
              {s.id}
            </Td>
            <Td>{s.name}</Td>
            <Td align="right" mono>
              {s.location.lat.toFixed(4)}
            </Td>
            <Td align="right" mono>
              {s.location.lon.toFixed(4)}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="border-l-2 border-red-500 bg-red-950/30 px-6 py-3 text-sm text-red-200">
      {message}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center text-sm text-zinc-500">{children}</div>
  );
}
