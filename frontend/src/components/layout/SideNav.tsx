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
    <nav className="h-full border-r border-zinc-800 bg-zinc-950">
      {sectionLabel ? (
        <div className="border-b border-zinc-800 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
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
                    ? 'bg-zinc-900 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-0.5 bg-zinc-100"
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
