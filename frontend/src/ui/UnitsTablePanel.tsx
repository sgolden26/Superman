import { Table, Td, Th } from '@/components/ui/Table';
import type { TheatreSnapshot } from '@/types/snapshot';

export interface UnitsTablePanelProps {
  snapshot: TheatreSnapshot;
  maxRows?: number;
}

/**
 * Scrollable unit inventory: callsign, echelon, strength. Dense console typography.
 */
export default function UnitsTablePanel({ snapshot, maxRows = 120 }: UnitsTablePanelProps) {
  const rows = snapshot.units.slice(0, maxRows);
  const truncated = snapshot.units.length > maxRows;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <Table>
          <thead>
            <tr>
              <Th>Callsign / unit</Th>
              <Th>Faction</Th>
              <Th>Domain</Th>
              <Th align="right" mono>
                Strength
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <Td>
                  <div className="font-medium">{u.callsign ?? u.name}</div>
                  <div className="text-[11px] text-mil-300">{u.name}</div>
                </Td>
                <Td mono>
                  <span className="text-xs text-mil-200">{u.faction_id}</span>
                </Td>
                <Td className="text-xs capitalize text-mil-200">{u.domain}</Td>
                <Td align="right" mono>
                  {u.strength !== undefined ? `${Math.round(u.strength * 100)}%` : '—'}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      {truncated ? (
        <p className="shrink-0 border-t border-mil-800 px-2 py-1.5 text-[10px] text-mil-400">
          Showing {maxRows} of {snapshot.units.length} units. Zoom the map for geographic context.
        </p>
      ) : null}
    </div>
  );
}
