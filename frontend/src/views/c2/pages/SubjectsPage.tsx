import type { ReactNode } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { Table, Td, Th } from '@/components/ui/Table';
import { useSubjects } from '@/hooks/useSubjects';
import type { Alignment, Subject } from '@/types/subject';

export default function SubjectsPage() {
  const { data, error, isLoading } = useSubjects();
  const count = data?.length ?? 0;

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <PageHeader
        title="Subjects"
        description="Identified and unidentified contacts in the operational area."
        meta={isLoading && data === null ? 'Loading' : `${count} contacts`}
      />
      <div className="min-h-0 flex-1 overflow-auto overscroll-none">
        {error ? <ErrorBanner message={error.message} /> : null}
        {data ? <SubjectsTable rows={data} /> : null}
      </div>
    </div>
  );
}

const ALIGNMENT_FILL: Record<Alignment, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  grey: 'bg-zinc-500',
};

function SubjectsTable({ rows }: { rows: Subject[] }) {
  if (rows.length === 0) {
    return <EmptyState>No subjects.</EmptyState>;
  }
  return (
    <Table>
      <colgroup>
        <col className="w-12" />
        <col className="w-16" />
        <col />
        <col className="w-28" />
        <col />
        <col className="w-56" />
      </colgroup>
      <thead>
        <tr>
          <Th />
          <Th align="right">ID</Th>
          <Th>Name</Th>
          <Th>Alignment</Th>
          <Th>Role</Th>
          <Th>Fingerprint</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.id} className="hover:bg-zinc-900/50">
            <Td>
              <span
                aria-label={s.alignment}
                className={`block h-3 w-3 ${ALIGNMENT_FILL[s.alignment]}`}
              />
            </Td>
            <Td align="right" mono className="text-zinc-500">
              {s.id}
            </Td>
            <Td className="font-medium">{s.name}</Td>
            <Td className="text-[11px] uppercase tracking-wider text-zinc-400">
              {s.alignment}
            </Td>
            <Td className="text-zinc-400">{describeRole(s)}</Td>
            <Td mono className="truncate text-zinc-400">
              {s.fingerprint}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function describeRole(s: Subject): string {
  const role = s.attributes.role;
  if (typeof role !== 'string') return '—';
  const squad = typeof s.attributes.squad === 'string' ? s.attributes.squad : null;
  return squad ? `${prettify(role)} · ${squad}` : prettify(role);
}

function prettify(s: string): string {
  return s.replace(/_/g, ' ');
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
