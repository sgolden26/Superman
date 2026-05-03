/**
 * Joins truthy class name fragments. Prefer this over ad hoc string concat
 * for Tailwind-heavy components.
 */
export function cn(
  ...parts: Array<string | undefined | null | false>
): string {
  return parts.filter(Boolean).join(" ");
}
