export type GroundMoveMode = "foot" | "vehicle";

export interface GroundMoveDraft {
  mode: GroundMoveMode;
  /** Frozen [lon, lat] from scenario when move planning started. */
  origin: [number, number];
  /** Pending destination; applied on “play” (shopping cart) later. */
  destination: [number, number] | null;
  /**
   * When true, map clicks only adjust this unit’s destination (no oblast/city/etc. selection).
   * After “Select destination”, stays false so the route remains while the map behaves normally.
   */
  pickingDestination: boolean;
}

const RADIUS_KM: Record<GroundMoveMode, number> = {
  foot: 24.1,
  vehicle: 250,
};

export function groundMoveRadiusKm(mode: GroundMoveMode): number {
  return RADIUS_KM[mode];
}

export function moveRadiusToastMessage(mode: GroundMoveMode): string {
  return `Maximum movement for this order is ${RADIUS_KM[mode]} km.`;
}

export function isGroundCombatUnit(domain: string): boolean {
  return domain === "ground";
}
