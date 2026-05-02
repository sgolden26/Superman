import type { ImageryFrame } from '@/types/imagery';

export interface ImageryOverlayProps {
  frames: ImageryFrame[];
  visible: boolean;
}

/** Toggleable satellite/drone imagery layer for the map. */
export default function ImageryOverlay(_props: ImageryOverlayProps) {
  return null;
}
