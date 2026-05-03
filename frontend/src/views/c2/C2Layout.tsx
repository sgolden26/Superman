import { Outlet } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import DemoViewSwitcher from '@/components/layout/DemoViewSwitcher';
import TopBar from '@/components/layout/TopBar';
import SideNav, { type NavItem } from '@/components/layout/SideNav';

const NAV: NavItem[] = [
  { label: 'Sensors', to: '/c2/sensors' },
  { label: 'Subjects', to: '/c2/subjects' },
];

/** Multi-operator command and control shell. */
export default function C2Layout() {
  return (
    <AppShell
      topBar={
        <TopBar
          eyebrow="Superman"
          title="Command & Control"
          right={<DemoViewSwitcher />}
        />
      }
      sideNav={<SideNav items={NAV} sectionLabel="Inventory" />}
    >
      <Outlet />
    </AppShell>
  );
}
