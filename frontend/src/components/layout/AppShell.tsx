import type { ReactNode } from 'react';

export interface AppShellProps {
  topBar: ReactNode;
  sideNav?: ReactNode;
  children: ReactNode;
}

/** Generic page shell. C2 and Field compose it with their own bars. */
export default function AppShell({ topBar, sideNav, children }: AppShellProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">{topBar}</div>
      <div className="flex min-h-0 flex-1">
        {sideNav ? <aside className="w-48 shrink-0">{sideNav}</aside> : null}
        <main className="min-h-0 flex-1 overflow-auto overscroll-none">{children}</main>
      </div>
    </div>
  );
}
