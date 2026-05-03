import type { Faction } from "@/types/scenario";

interface Props {
  faction: Faction;
}

export function FactionTag({ faction }: Props) {
  return (
    <span
      className="inline-flex items-center gap-1.5 border px-1.5 py-[3px] font-mono text-[10px] uppercase tracking-wider2"
      style={{
        borderColor: `${faction.color}66`,
        color: faction.color,
        background: `${faction.color}14`,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-[1px]"
        style={{ background: faction.color }}
      />
      {faction.name}
    </span>
  );
}
