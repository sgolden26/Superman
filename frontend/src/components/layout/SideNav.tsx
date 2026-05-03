import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/classnames';

export interface NavItem {
  label: string;
  to: string;
}

export interface SideNavProps {
  items: NavItem[];
  sectionLabel?: string;
}

export default function SideNav({ items, sectionLabel }: SideNavProps) {
  return (
    <nav className="h-full border-r border-slate-800 bg-slate-950">
      {sectionLabel ? (
        <div className="border-b border-slate-800 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          {sectionLabel}
        </div>
      ) : null}
      <ul>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end
              className={({ isActive }) =>
                cn(
                  'relative block px-4 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-slate-900 text-slate-100'
                    : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-0.5 bg-sky-400"
                    />
                  ) : null}
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
