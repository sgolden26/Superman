"""SnapshotExporter: walk a Theater into the JSON shape defined in docs/schema.md."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from axis import SCHEMA_VERSION
from axis.decision.actions import DEFAULT_ACTIONS, Action, action_catalog_to_dict
from axis.domain.city import City
from axis.domain.country import (
    BilateralRelation,
    Border,
    CabinetMember,
    Composition,
    Country,
    Demographics,
    Diplomacy,
    EnergyLogistics,
    Geography,
    Government,
    InventoryLine,
    KeyBase,
    Military,
    NuclearPosture,
    PublicOpinion,
    ServiceBranch,
    Treaty,
)
from axis.domain.faction import Faction
from axis.domain.frontline import Frontline
from axis.domain.military_assets import (
    Airfield,
    AreaOfResponsibility,
    BorderCrossing,
    Depot,
    IsrCoverage,
    MissileRange,
    NavalBase,
    SupplyLine,
)
from axis.domain.oblast import Oblast
from axis.domain.political import (
    CredibilityTrack,
    FactionPressure,
    GapEvent,
    LeaderSignal,
    PressureState,
    RegionPressure,
)
from axis.domain.territory import Territory
from axis.domain.theater import Theater
from axis.units.base import Unit


class SnapshotExporter:
    """Convert a `Theater` into a JSON-serialisable dict matching the schema."""

    def __init__(
        self,
        theater: Theater,
        *,
        actions: tuple[Action, ...] = DEFAULT_ACTIONS,
    ) -> None:
        self._theater = theater
        self._actions = actions

    def to_dict(self) -> dict[str, Any]:
        t = self._theater
        return {
            "schema_version": SCHEMA_VERSION,
            "scenario": {
                "id": t.id,
                "name": t.name,
                "classification": t.classification,
                "clock": t.clock.isoformat(),
                "bbox": list(t.bbox.as_tuple()),
            },
            "factions": [self._faction(f) for f in t.factions],
            "countries": [self._country(c) for c in t.countries],
            "cities": [self._city(c) for c in t.cities],
            "territories": [self._territory(p) for p in t.territories],
            "oblasts": [self._oblast(o) for o in t.oblasts],
            "units": [self._unit(u) for u in t.units],
            "depots": [self._depot(d) for d in t.depots],
            "airfields": [self._airfield(a) for a in t.airfields],
            "naval_bases": [self._naval_base(n) for n in t.naval_bases],
            "border_crossings": [self._crossing(x) for x in t.border_crossings],
            "supply_lines": [self._supply_line(s) for s in t.supply_lines],
            "isr_coverages": [self._isr(i) for i in t.isr_coverages],
            "missile_ranges": [self._missile(m) for m in t.missile_ranges],
            "aors": [self._aor(a) for a in t.aors],
            "frontlines": [self._frontline(f) for f in t.frontlines],
            "current_turn": t.current_turn,
            "pressure": self._pressure(t.pressure),
            "credibility": [self._credibility(c) for c in t.credibility],
            "leader_signals": [self._leader_signal(s) for s in t.leader_signals],
            "actions": action_catalog_to_dict(self._actions),
        }

    def write(self, path: Path | str, *, indent: int = 2) -> Path:
        out_path = Path(path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(self.to_dict(), indent=indent) + "\n")
        return out_path

    @staticmethod
    def _faction(f: Faction) -> dict[str, Any]:
        return {
            "id": f.id,
            "name": f.name,
            "allegiance": f.allegiance.value,
            "color": f.color,
        }

    @staticmethod
    def _city(c: City) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": c.id,
            "name": c.name,
            "faction_id": c.faction_id,
            "position": [c.position.lon, c.position.lat],
            "population": c.population,
            "importance": c.importance.value,
            "infrastructure": list(c.infrastructure),
        }
        if c.country_id is not None:
            out["country_id"] = c.country_id
        return out

    @staticmethod
    def _territory(t: Territory) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": t.id,
            "name": t.name,
            "faction_id": t.faction_id,
            "polygon": [[[pt.lon, pt.lat] for pt in ring] for ring in t.polygon],
            "control": t.control,
        }
        if t.country_id is not None:
            out["country_id"] = t.country_id
        return out

    @staticmethod
    def _unit(u: Unit) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": u.id,
            "name": u.name,
            "faction_id": u.faction_id,
            "domain": u.domain.value,
            "kind": u.kind.value,
            "position": [u.position.lon, u.position.lat],
            "strength": u.strength,
            "readiness": u.readiness,
            "morale": u.morale,
            "entrenchment": u.entrenchment,
            "echelon": u.echelon,
            "callsign": u.callsign,
            "available_actions": list(u.available_actions),
        }
        if u.country_id is not None:
            out["country_id"] = u.country_id
        if u.home_base_id is not None:
            out["home_base_id"] = u.home_base_id
        return out

    @classmethod
    def _country(cls, c: Country) -> dict[str, Any]:
        return {
            "id": c.id,
            "iso_a2": c.iso_a2,
            "iso_a3": c.iso_a3,
            "name": c.name,
            "official_name": c.official_name,
            "faction_id": c.faction_id,
            "flag_emoji": c.flag_emoji,
            "capital_city_id": c.capital_city_id,
            "government": cls._government(c.government),
            "military": cls._military(c.military),
            "nuclear": cls._nuclear(c.nuclear),
            "demographics": cls._demographics(c.demographics),
            "diplomacy": cls._diplomacy(c.diplomacy),
            "energy": cls._energy(c.energy),
            "public_opinion": cls._public_opinion(c.public_opinion),
            "geography": cls._geography(c.geography),
            "available_actions": list(c.available_actions),
        }

    @staticmethod
    def _cabinet_member(m: CabinetMember) -> dict[str, Any]:
        return {"title": m.title, "name": m.name}

    @classmethod
    def _government(cls, g: Government) -> dict[str, Any]:
        return {
            "regime_type": g.regime_type.value,
            "head_of_state": g.head_of_state,
            "head_of_government": g.head_of_government,
            "cabinet": [cls._cabinet_member(m) for m in g.cabinet],
            "approval_rating": g.approval_rating,
            "stability_index": g.stability_index,
            "last_election": g.last_election,
            "next_election": g.next_election,
        }

    @staticmethod
    def _inventory_line(line: InventoryLine) -> dict[str, Any]:
        return {
            "category": line.category,
            "label": line.label,
            "count": line.count,
            "status": line.status.value,
        }

    @classmethod
    def _branch(cls, b: ServiceBranch) -> dict[str, Any]:
        return {
            "name": b.name,
            "personnel": b.personnel,
            "inventory": [cls._inventory_line(i) for i in b.inventory],
        }

    @classmethod
    def _military(cls, m: Military) -> dict[str, Any]:
        return {
            "active_personnel": m.active_personnel,
            "reserve_personnel": m.reserve_personnel,
            "paramilitary": m.paramilitary,
            "branches": [cls._branch(b) for b in m.branches],
            "doctrine": m.doctrine,
            "posture": m.posture.value,
            "alert_level": m.alert_level,
            "c2_nodes": list(m.c2_nodes),
        }

    @staticmethod
    def _nuclear(n: NuclearPosture) -> dict[str, Any]:
        return {
            "status": n.status.value,
            "warheads": n.warheads,
            "delivery_systems": list(n.delivery_systems),
            "declared_posture": n.declared_posture,
            "nfu": n.nfu,
        }

    @staticmethod
    def _composition(c: Composition) -> dict[str, Any]:
        return {"label": c.label, "share": c.share}

    @classmethod
    def _demographics(cls, d: Demographics) -> dict[str, Any]:
        return {
            "population": d.population,
            "median_age": d.median_age,
            "urbanisation": d.urbanisation,
            "ethnic_groups": [cls._composition(c) for c in d.ethnic_groups],
            "languages": [cls._composition(c) for c in d.languages],
            "religions": [cls._composition(c) for c in d.religions],
        }

    @staticmethod
    def _treaty(t: Treaty) -> dict[str, Any]:
        return {
            "name": t.name,
            "kind": t.kind,
            "parties": list(t.parties),
            "in_force": t.in_force,
        }

    @staticmethod
    def _relation(r: BilateralRelation) -> dict[str, Any]:
        return {
            "other_country_id": r.other_country_id,
            "status": r.status.value,
            "score": r.score,
        }

    @classmethod
    def _diplomacy(cls, d: Diplomacy) -> dict[str, Any]:
        return {
            "alliance_memberships": list(d.alliance_memberships),
            "treaties": [cls._treaty(t) for t in d.treaties],
            "relations": [cls._relation(r) for r in d.relations],
        }

    @staticmethod
    def _energy(e: EnergyLogistics) -> dict[str, Any]:
        return {
            "oil_dependence": e.oil_dependence,
            "gas_dependence": e.gas_dependence,
            "top_gas_supplier": e.top_gas_supplier,
            "pipelines": list(e.pipelines),
            "key_ports": list(e.key_ports),
            "rail_gauge_mm": e.rail_gauge_mm,
            "strategic_reserves_days": e.strategic_reserves_days,
        }

    @staticmethod
    def _public_opinion(p: PublicOpinion) -> dict[str, Any]:
        return {
            "war_support": p.war_support,
            "institutional_trust": p.institutional_trust,
            "censorship_index": p.censorship_index,
            "protest_intensity": p.protest_intensity,
            "top_outlets": list(p.top_outlets),
        }

    @staticmethod
    def _border(b: Border) -> dict[str, Any]:
        return {"other": b.other, "length_km": b.length_km}

    @staticmethod
    def _key_base(k: KeyBase) -> dict[str, Any]:
        return {
            "name": k.name,
            "kind": k.kind,
            "lon": k.lon,
            "lat": k.lat,
            "owner_country_id": k.owner_country_id,
        }

    @classmethod
    def _geography(cls, g: Geography) -> dict[str, Any]:
        return {
            "area_km2": g.area_km2,
            "land_borders": [cls._border(b) for b in g.land_borders],
            "key_bases": [cls._key_base(k) for k in g.key_bases],
        }

    # ---------------------------------------------------------------------
    # v0.4.0: oblasts, frontline, geospatial military assets
    # ---------------------------------------------------------------------

    @staticmethod
    def _oblast(o: Oblast) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": o.id,
            "iso_3166_2": o.iso_3166_2,
            "name": o.name,
            "country_id": o.country_id,
            "faction_id": o.faction_id,
            "population": o.population,
            "area_km2": o.area_km2,
            "control": o.control,
            "contested": o.contested,
            "morale": o.morale,
            "civil_unrest": o.civil_unrest,
            "refugees_outflow": o.refugees_outflow,
            "available_actions": list(o.available_actions),
        }
        if o.capital_city_id is not None:
            out["capital_city_id"] = o.capital_city_id
        if o.centroid is not None:
            out["centroid"] = [o.centroid.lon, o.centroid.lat]
        return out

    @staticmethod
    def _depot(d: Depot) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": d.id,
            "name": d.name,
            "faction_id": d.faction_id,
            "position": [d.position.lon, d.position.lat],
            "capacity": d.capacity,
            "fill": d.fill,
            "available_actions": list(d.available_actions),
        }
        if d.country_id is not None:
            out["country_id"] = d.country_id
        return out

    @staticmethod
    def _airfield(a: Airfield) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": a.id,
            "name": a.name,
            "faction_id": a.faction_id,
            "position": [a.position.lon, a.position.lat],
            "runway_m": a.runway_m,
            "role": a.role,
            "based_aircraft": a.based_aircraft,
            "available_actions": list(a.available_actions),
        }
        if a.country_id is not None:
            out["country_id"] = a.country_id
        return out

    @staticmethod
    def _naval_base(n: NavalBase) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": n.id,
            "name": n.name,
            "faction_id": n.faction_id,
            "position": [n.position.lon, n.position.lat],
            "pier_count": n.pier_count,
            "home_port_for": list(n.home_port_for),
            "available_actions": list(n.available_actions),
        }
        if n.country_id is not None:
            out["country_id"] = n.country_id
        return out

    @staticmethod
    def _crossing(c: BorderCrossing) -> dict[str, Any]:
        return {
            "id": c.id,
            "name": c.name,
            "faction_id": c.faction_id,
            "position": [c.position.lon, c.position.lat],
            "countries": list(c.countries),
            "mode": c.mode.value,
            "rail": c.rail,
            "road": c.road,
            "available_actions": list(c.available_actions),
        }

    @staticmethod
    def _supply_line(s: SupplyLine) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": s.id,
            "name": s.name,
            "faction_id": s.faction_id,
            "path": [[p.lon, p.lat] for p in s.path],
            "health": s.health,
            "mode": s.mode,
            "available_actions": list(s.available_actions),
        }
        if s.from_id is not None:
            out["from_id"] = s.from_id
        if s.to_id is not None:
            out["to_id"] = s.to_id
        return out

    @staticmethod
    def _isr(i: IsrCoverage) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": i.id,
            "name": i.name,
            "faction_id": i.faction_id,
            "origin": [i.origin.lon, i.origin.lat],
            "range_km": i.range_km,
            "heading_deg": i.heading_deg,
            "beam_deg": i.beam_deg,
            "platform": i.platform,
            "confidence": i.confidence,
            "available_actions": list(i.available_actions),
        }
        if i.country_id is not None:
            out["country_id"] = i.country_id
        return out

    @staticmethod
    def _missile(m: MissileRange) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": m.id,
            "name": m.name,
            "faction_id": m.faction_id,
            "origin": [m.origin.lon, m.origin.lat],
            "range_km": m.range_km,
            "weapon": m.weapon,
            "category": m.category,
            "heading_deg": m.heading_deg,
            "beam_deg": m.beam_deg,
            "available_actions": list(m.available_actions),
        }
        if m.country_id is not None:
            out["country_id"] = m.country_id
        return out

    @staticmethod
    def _aor(a: AreaOfResponsibility) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": a.id,
            "name": a.name,
            "faction_id": a.faction_id,
            "polygon": [[[pt.lon, pt.lat] for pt in ring] for ring in a.polygon],
            "available_actions": list(a.available_actions),
        }
        if a.formation_id is not None:
            out["formation_id"] = a.formation_id
        if a.country_id is not None:
            out["country_id"] = a.country_id
        return out

    @staticmethod
    def _frontline(f: Frontline) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": f.id,
            "name": f.name,
            "path": [[p.lon, p.lat] for p in f.path],
            "buffer_km": f.buffer_km,
            "notes": f.notes,
            "available_actions": list(f.available_actions),
        }
        if f.updated_at is not None:
            out["updated_at"] = f.updated_at.isoformat()
        return out

    # ---------------------------------------------------------------------
    # v0.5.0: political layer (pressure, credibility, leader signals)
    # ---------------------------------------------------------------------

    @classmethod
    def _pressure(cls, p: PressureState) -> dict[str, Any]:
        out: dict[str, Any] = {
            "factions": [cls._faction_pressure(fp) for fp in p.factions],
            "regions": [cls._region_pressure(rp) for rp in p.regions],
        }
        if p.global_deadline_turn is not None:
            out["global_deadline_turn"] = p.global_deadline_turn
        return out

    @staticmethod
    def _faction_pressure(fp: FactionPressure) -> dict[str, Any]:
        out: dict[str, Any] = {
            "faction_id": fp.faction_id,
            "intensity": fp.intensity,
            "drivers": list(fp.drivers),
        }
        if fp.deadline_turn is not None:
            out["deadline_turn"] = fp.deadline_turn
        if fp.team_goal is not None:
            out["team_goal"] = fp.team_goal
        return out

    @staticmethod
    def _region_pressure(rp: RegionPressure) -> dict[str, Any]:
        return {
            "region_id": rp.region_id,
            "intensity": rp.intensity,
            "drivers": list(rp.drivers),
        }

    @classmethod
    def _credibility(cls, t: CredibilityTrack) -> dict[str, Any]:
        return {
            "from_faction_id": t.from_faction_id,
            "to_faction_id": t.to_faction_id,
            "immediate": t.immediate,
            "resolve": t.resolve,
            "last_updated_turn": t.last_updated_turn,
            "history": [cls._gap_event(g) for g in t.history],
        }

    @staticmethod
    def _gap_event(g: GapEvent) -> dict[str, Any]:
        return {
            "turn": g.turn,
            "signal_severity": g.signal_severity,
            "action_severity": g.action_severity,
            "gap": g.gap,
            "source": g.source,
            "note": g.note,
        }

    @staticmethod
    def _leader_signal(s: LeaderSignal) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": s.id,
            "timestamp": s.timestamp.isoformat(),
            "speaker_faction_id": s.speaker_faction_id,
            "type": s.type.value,
            "severity": s.severity,
            "text": s.text,
            "source": s.source,
        }
        if s.target_faction_id is not None:
            out["target_faction_id"] = s.target_faction_id
        if s.region_id is not None:
            out["region_id"] = s.region_id
        if s.cameo_code is not None:
            out["cameo_code"] = s.cameo_code
        if s.goldstein is not None:
            out["goldstein"] = s.goldstein
        if s.source_url is not None:
            out["source_url"] = s.source_url
        if s.turn is not None:
            out["turn"] = s.turn
        return out
