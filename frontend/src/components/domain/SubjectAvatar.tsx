import type { Subject } from '@/types/subject';

export interface SubjectAvatarProps {
  subject: Subject;
  size?: 'sm' | 'md' | 'lg';
}

/** Pseudonymous identicon plus alias. No biometric photographs. */
export default function SubjectAvatar(_props: SubjectAvatarProps) {
  return <span aria-label="subject avatar" />;
}
