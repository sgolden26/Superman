export interface NavItem {
  label: string;
  to: string;
  icon?: string;
}

export interface SideNavProps {
  items: NavItem[];
}

export default function SideNav(_props: SideNavProps) {
  return <nav className="h-full border-r border-slate-800" />;
}
