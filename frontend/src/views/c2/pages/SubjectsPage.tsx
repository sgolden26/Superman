import Card from '@/components/ui/Card';
import { useSubjects } from '@/hooks/useSubjects';
import type { Subject } from '@/types/subject';

/** Subject inventory: identity, name, location. */
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
        <Card className="text-sm text-slate-400">
          No subjects yet. Wire a data source in <code>SubjectRepository.list</code>.
        </Card>
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

function SubjectRow({ subject }: { subject: Subject }) {
  return (
    <li>
      <Card className="flex items-center justify-between gap-4 text-sm">
        <div>
          <div className="font-medium text-slate-100">{subject.name}</div>
          <div className="text-xs text-slate-500">{subject.id}</div>
        </div>
        <div className="font-mono text-xs text-slate-300">
          {subject.location.lat.toFixed(4)}, {subject.location.lon.toFixed(4)}
        </div>
      </Card>
    </li>
  );
}
