import { Outlet } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import DemoViewSwitcher from '@/components/layout/DemoViewSwitcher';
import TopBar from '@/components/layout/TopBar';

/**
 * Frontline shell. High contrast, large hit targets, mobile-first.
 * Tabbed navigation lives at the bottom of the screen for thumb reach,
 * not in a side rail.
 */
export default function FieldLayout() {
  return (
    <AppShell
      topBar={
        <TopBar eyebrow="Superman" title="Field" right={<DemoViewSwitcher />} />
      }
    >
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1">
          <Outlet />
        </div>
        <FieldTabs />
      </div>
    </AppShell>
  );
}

function FieldTabs() {
  return <nav className="border-t border-slate-800" data-component="FieldTabs" />;
}
