import { useAppStore } from "@/state/store";
import type { Country } from "@/types/country";

interface Props {
  countryId: string | null | undefined;
}

/** Small clickable chip that selects the country dossier when known. */
export function CountryBadge({ countryId }: Props) {
  const country = useAppStore((s) =>
    countryId
      ? (s.scenario?.countries.find((c) => c.id === countryId) as Country | undefined)
      : undefined,
  );
  const select = useAppStore((s) => s.select);

  if (!countryId) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider2 text-mil-300">
        no country
      </span>
    );
  }

  if (!country) {
    return (
      <span
        className="border border-[var(--seam)] px-1.5 py-[3px] font-mono text-[10px] uppercase tracking-wider2 text-mil-300"
        title="dossier not seeded"
      >
        {countryId}
      </span>
    );
  }

  return (
    <button
      onClick={() => select({ kind: "country", id: country.id })}
      className="inline-flex items-center gap-1.5 border border-[var(--seam)] bg-mil-700/40 px-1.5 py-[3px] font-mono text-[10px] uppercase tracking-wider2 text-mil-50 transition-colors hover:border-[var(--seam-strong)] hover:bg-mil-700/80"
      title={`Open ${country.name} dossier`}
    >
      <span className="text-[12px] leading-none">{country.flag_emoji}</span>
      {country.name}
      <span className="text-mil-300">→</span>
    </button>
  );
}
