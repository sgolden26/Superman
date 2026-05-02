export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastDescriptor {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

export default function Toast(_props: ToastDescriptor) {
  throw new Error('Not implemented');
}
