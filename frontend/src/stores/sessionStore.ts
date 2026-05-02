import type { Mission } from '@/types/mission';

/** Per-session UI state: active mission, selected subject, map viewport. */
export interface SessionState {
  activeMission: Mission | null;
  selectedSubjectId: string | null;
  setActiveMission: (mission: Mission | null) => void;
  selectSubject: (id: string | null) => void;
}

export function createSessionStore(): SessionState {
  throw new Error('Not implemented');
}
