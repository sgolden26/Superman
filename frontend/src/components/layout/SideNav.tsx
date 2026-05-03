import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/classnames';

export interface NavItem {
  label: string;
  to: string;
  icon?: string;
}

export interface SideNavProps {
  items: NavItem[];
}

export default function SideNav({ items }: SideNavProps) {
  return (
    <nav className="h-full border-r border-slate-800 bg-slate-950/40 p-2">
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end
              className={({ isActive }) =>
                cn(
                  'block rounded-md px-3 py-1.5 text-sm transition',
                  isActive
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200',
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
