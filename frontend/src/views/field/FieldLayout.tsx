import { Outlet } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import DemoViewSwitcher from '@/components/layout/DemoViewSwitcher';
import TopBar from '@/components/layout/TopBar';

/** Frontline shell. Reduced to a single subjects view for now. */
export default function FieldLayout() {
  return (
    <AppShell topBar={<TopBar title="Field" right={<DemoViewSwitcher />} />}>
      <Outlet />
    </AppShell>
  );
}
