import { Outlet } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import DemoViewSwitcher from '@/components/layout/DemoViewSwitcher';
import TopBar from '@/components/layout/TopBar';
import SideNav, { type NavItem } from '@/components/layout/SideNav';

const NAV: NavItem[] = [
  { label: 'Dashboard', to: '/c2' },
  { label: 'Map', to: '/c2/map' },
  { label: 'Subjects', to: '/c2/subjects' },
  { label: 'Alerts', to: '/c2/alerts' },
  { label: 'Sensors', to: '/c2/sensors' },
  { label: 'Missions', to: '/c2/missions' },
];

/** Multi-operator command and control shell. Map-first, dense information. */
export default function C2Layout() {
  return (
    <AppShell
      topBar={<TopBar title="Command and Control" right={<DemoViewSwitcher />} />}
      sideNav={<SideNav items={NAV} />}
    >
      <Outlet />
    </AppShell>
  );
}
