import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/classnames';

/**
 * Demo-only: jump between the two product surfaces with no sign-in.
 */
export default function DemoViewSwitcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const onC2 = location.pathname.startsWith('/c2');

  return (
    <div
      className="flex rounded-lg border border-slate-700 bg-slate-900/60 p-0.5 text-xs font-medium"
      role="group"
      aria-label="Switch demo view"
    >
      <button
        type="button"
        onClick={() => {
          navigate('/c2');
        }}
        className={cn(
          'rounded-md px-3 py-1.5 transition',
          onC2 ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200',
        )}
      >
        Command
      </button>
      <button
        type="button"
        onClick={() => {
          navigate('/field');
        }}
        className={cn(
          'rounded-md px-3 py-1.5 transition',
          !onC2 ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200',
        )}
      >
        Field
      </button>
    </div>
  );
}
