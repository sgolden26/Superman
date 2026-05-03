import { create } from 'zustand';
import { fetchSnapshot } from '@/api/fetchSnapshot';
import type { TheatreSnapshot } from '@/types/snapshot';

export interface TheatreStoreState {
  snapshot: TheatreSnapshot | null;
  error: string | null;
  isLoading: boolean;
  /** Pull the latest snapshot from `/state.json`. */
  refresh: () => Promise<void>;
}

export const useTheatreStore = create<TheatreStoreState>((set) => ({
  snapshot: null,
  error: null,
  isLoading: true,

  refresh: async () => {
    set({ isLoading: true, error: null });
    try {
      const snapshot = await fetchSnapshot();
      set({ snapshot, isLoading: false, error: null });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load theatre snapshot';
      set({ error: message, isLoading: false });
    }
  },
}));
