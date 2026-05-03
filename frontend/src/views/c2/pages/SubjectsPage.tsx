import Card from '@/components/ui/Card';
import { useSubjects } from '@/hooks/useSubjects';
import type { Alignment, Subject } from '@/types/subject';

/** Subject inventory: identity, alignment, fingerprint. */
export default function SubjectsPage() {
  const { data, error, isLoading } = useSubjects();

  return (
    <div className="space-y-3 p-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-slate-100">Subjects</h2>
        <span className="text-xs text-slate-500">
          {isLoading && data === null ? 'Loading…' : `${data?.length ?? 0} subject(s)`}
        </span>
      </header>

      {error ? (
        <Card className="border-red-900/60 bg-red-950/40 text-sm text-red-200">
          {error.message}
        </Card>
      ) : null}

      {data && data.length === 0 ? (
        <Card className="text-sm text-slate-400">No subjects.</Card>
      ) : null}

      {data && data.length > 0 ? (
        <ul className="space-y-2">
          {data.map((subject) => (
            <SubjectRow key={subject.id} subject={subject} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const ALIGNMENT_DOT: Record<Alignment, string> = {
  blue: 'bg-sky-400',
  green: 'bg-emerald-400',
  red: 'bg-rose-500',
  grey: 'bg-slate-500',
};

function SubjectRow({ subject }: { subject: Subject }) {
  return (
    <li>
      <Card className="flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${ALIGNMENT_DOT[subject.alignment]}`}
            aria-label={subject.alignment}
          />
          <div>
            <div className="font-medium text-slate-100">{subject.name}</div>
            <div className="text-xs text-slate-500">
              <span className="uppercase tracking-wide">{subject.alignment}</span>
              {' · '}
              <span className="font-mono">{subject.fingerprint.slice(0, 12)}…</span>
            </div>
          </div>
        </div>
      </Card>
    </li>
  );
}
