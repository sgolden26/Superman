import type { ReactNode } from 'react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  children: ReactNode;
}

export default function Drawer(_props: DrawerProps) {
  throw new Error('Not implemented');
}
