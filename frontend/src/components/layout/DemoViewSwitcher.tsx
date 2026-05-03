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
      className="flex border border-slate-700 bg-slate-900 text-[11px] font-medium uppercase tracking-wider"
      role="group"
      aria-label="Switch demo view"
    >
      <SwitchButton active={onC2} onClick={() => navigate('/c2')}>
        Command
      </SwitchButton>
      <SwitchButton active={!onC2} onClick={() => navigate('/field')}>
        Field
      </SwitchButton>
    </div>
  );
}

function SwitchButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 transition-colors',
        active
          ? 'bg-slate-100 text-slate-900'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
      )}
    >
      {children}
    </button>
  );
}
