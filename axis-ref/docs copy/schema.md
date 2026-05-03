# Scenario snapshot schema

Single source of truth for the FE/BE contract. Mirrored by:

- Python: `backend/axis/domain/*` (pydantic) plus `backend/axis/serialization/snapshot.py`
- TypeScript: `frontend/src/types/scenario.ts` (zod, runtime-validated on load)

The backend produces `data/state.json`; the frontend reads `public/state.json`. Bump `schema_version` on any breaking change and update both mirrors in the same PR.

The dynamic morale / event signal layer is split into a separate
`data/intel.json` (see [intel.md](./intel.md)) so it can be refreshed
independently of the static world.

## Top level

```jsonc
{
  "schema_version": "0.4.0",
  "scenario": {
    "id": "eastern_europe",
    "name": "Russia / Ukraine theatre",
    "classification": "UNCLASSIFIED // EXERCISE",
    "clock": "2026-04-25T11:00:00Z",
    "bbox": [22.0, 44.0, 50.0, 56.0]   // [minLon, minLat, maxLon, maxLat]
  },
  "factions": [Faction, ...],
  "countries": [Country, ...],
  "cities": [City, ...],
  "territories": [Territory, ...],
  "oblasts": [Oblast, ...],
  "units": [Unit, ...],
  "depots": [Depot, ...],
  "airfields": [Airfield, ...],
  "naval_bases": [NavalBase, ...],
  "border_crossings": [BorderCrossing, ...],
  "supply_lines": [SupplyLine, ...],
  "isr_coverages": [IsrCoverage, ...],
  "missile_ranges": [MissileRange, ...],
  "aors": [Aor, ...],
  "frontlines": [Frontline, ...],
  "actions": [Action, ...]
}
```

## Oblast (admin-1 region)

```jsonc
{
  "id": "oblast.UA-46",
  "iso_3166_2": "UA-46",      // joins frontend/public/borders/admin1_ua.geojson
  "name": "Lviv",
  "country_id": "ua",
  "faction_id": "ua",
  "population": 2497750,
  "area_km2": 21833,
  "control": 1.0,              // 0..1 share of effective control
  "contested": false,
  "morale": 0.74,
  "civil_unrest": 0.12,
  "refugees_outflow": 4200,
  "centroid": [24.03, 49.84],
  "available_actions": ["evacuate_civilians"]
}
```

## Military assets

`Depot`, `Airfield`, `NavalBase`, `BorderCrossing` are point features with
`position: [lon, lat]`, faction colouring and kind-specific extras
(`capacity` + `fill` for depots; `runway_m`, `role`, `based_aircraft` for
airfields; `pier_count`, `home_port_for` for naval bases; `mode`, `road`,
`rail`, `countries` for crossings). `SupplyLine` is a polyline with a
`mode` (`road | rail | air | sea`), `from_id`/`to_id`, `path` of `[lon, lat]`
vertices and a normalised `health`. `IsrCoverage` is a sector or omni circle
(`origin`, `range_km`, `heading_deg`, `beam_deg`, `platform`, `confidence`).
`MissileRange` is the same shape with `weapon`, `category` (`sram | mrbm | irbm | cruise | hgv`).
`Aor` is a polygon (one or more rings) tied to a `formation_id`.

## Frontline

```jsonc
{
  "id": "front.donbas",
  "name": "Donbas line of contact",
  "path": [[lon, lat], ...],
  "buffer_km": 12,                 // contested band width to render around the trace
  "updated_at": "2026-04-20T00:00:00Z",
  "notes": "Approximate line of contact (open source).",
  "available_actions": []
}
```

## Faction

```jsonc
{
  "id": "nato",
  "name": "NATO",
  "allegiance": "blue",        // blue | red | neutral
  "color": "#5aa9ff"
}
```

## Country

A sovereign state with deep nested attributes. Belongs to exactly one
`faction` (alliance/coalition layer). All metric scalars are floats in `[0, 1]`
unless noted.

```jsonc
{
  "id": "lt",
  "iso_a2": "LT",
  "iso_a3": "LTU",
  "name": "Lithuania",
  "official_name": "Republic of Lithuania",
  "faction_id": "nato",
  "flag_emoji": "🇱🇹",
  "capital_city_id": "city.vilnius",
  "government": {
    "regime_type": "liberal_democracy",   // liberal_democracy | illiberal_democracy | hybrid | authoritarian | military_junta
    "head_of_state": "President (stub)",
    "head_of_government": "Prime Minister (stub)",
    "cabinet": [{ "title": "Defence Minister", "name": "(stub)" }],
    "approval_rating": 0.46,               // 0..1
    "stability_index": 0.78,               // 0..1
    "last_election": "2024-10-13",
    "next_election": "2028-10"
  },
  "military": {
    "active_personnel": 23000,
    "reserve_personnel": 104000,
    "paramilitary": 14500,
    "branches": [
      {
        "name": "Lithuanian Land Force",
        "personnel": 14500,
        "inventory": [
          { "category": "ifv", "label": "Boxer (Vilkas)", "count": 88, "status": "operational" }
        ]
      }
    ],
    "doctrine": "Total defence; deny rapid fait accompli...",
    "posture": "defensive",                // defensive | deterrent | offensive | expeditionary
    "alert_level": 4,                       // 1..5
    "c2_nodes": ["Vilnius MOD"]
  },
  "nuclear": {
    "status": "umbrella_host",             // nws | umbrella_host | latent | none
    "warheads": 0,
    "delivery_systems": [],
    "declared_posture": "Non-nuclear; relies on NATO extended deterrence.",
    "nfu": null                              // bool | null
  },
  "demographics": {
    "population": 2790000,
    "median_age": 44.8,
    "urbanisation": 0.68,
    "ethnic_groups": [{ "label": "Lithuanian", "share": 0.84 }],
    "languages": [{ "label": "Lithuanian", "share": 0.85 }],
    "religions": [{ "label": "Roman Catholic", "share": 0.74 }]
  },
  "diplomacy": {
    "alliance_memberships": ["NATO", "EU"],
    "treaties": [
      { "name": "North Atlantic Treaty", "kind": "collective_defence", "parties": ["NATO members"], "in_force": true }
    ],
    "relations": [
      { "other_country_id": "by", "status": "hostile", "score": -0.7 }   // status: allied | friendly | neutral | strained | hostile, score: -1..+1
    ]
  },
  "energy": {
    "oil_dependence": 0.95,                // 0..1, share imported
    "gas_dependence": 1.0,
    "top_gas_supplier": "USA / Norway (LNG via Klaipeda)",
    "pipelines": ["Klaipeda LNG terminal"],
    "key_ports": ["Klaipeda"],
    "rail_gauge_mm": 1520,                  // 1435 standard, 1520 broad
    "strategic_reserves_days": 90
  },
  "public_opinion": {
    "war_support": 0.62,                   // 0..1
    "institutional_trust": 0.55,
    "censorship_index": 0.10,
    "protest_intensity": 0.18,
    "top_outlets": ["LRT", "Delfi"]
  },
  "geography": {
    "area_km2": 65300,
    "land_borders": [{ "other": "lv", "length_km": 588 }],
    "key_bases": [
      { "name": "Siauliai Air Base (NATO BAP)", "kind": "air_base", "lon": 23.395, "lat": 55.8945, "owner_country_id": "lt" }
    ]
  },
  "available_actions": ["raise_alert_level", "mobilise_reserves", "invoke_article_5"]
}
```

## City

```jsonc
{
  "id": "city.vilnius",
  "name": "Vilnius",
  "faction_id": "nato",
  "position": [25.2797, 54.6872],   // [lon, lat]
  "population": 588000,
  "importance": "capital",          // capital | major | minor
  "infrastructure": ["air_base", "rail_hub"],
  "country_id": "lt"                  // optional; omitted -> alliance-only entity
}
```

## Territory

```jsonc
{
  "id": "terr.lithuania",
  "name": "Lithuania",
  "faction_id": "nato",
  "polygon": [[[lon, lat], ...]],   // GeoJSON Polygon coordinates (single ring)
  "control": 0.95,                    // 0..1 share of effective control
  "country_id": "lt"                  // optional
}
```

## Unit

```jsonc
{
  "id": "unit.nato.armd-1",
  "name": "1st Armoured Bde",
  "faction_id": "nato",
  "domain": "ground",                  // ground | air | naval
  "kind": "armoured_brigade",          // infantry_brigade | armoured_brigade | air_wing | naval_task_group
  "position": [22.6, 54.4],
  "strength": 0.92,                    // 0..1
  "readiness": 0.78,                   // 0..1
  "morale": 0.81,                      // 0..1 (stub, will be driven by intel layer later)
  "echelon": "brigade",
  "callsign": "IRON-1",
  "country_id": "lt",                  // optional; omitted -> alliance-only
  "available_actions": ["advance", "engage"]   // affordances; v1 execution stubbed
}
```

## Action

```jsonc
{
  "id": "deploy_troops",
  "name": "Deploy Troops",
  "description": "Move kinetic forces into the region.",
  "base_rate": 0.65,         // baseline P(success), 0..1
  "morale_weight": 0.30,      // signed multiplier on (morale-50)/50
  "trend_weight": 0.10,       // signed multiplier on trend (-1|0|+1)
  "severity_weight": 0.20,    // signed multiplier on net recent-event severity (-1..+1)
  "category_sensitivities": { // signed; how each category nudges this action
    "protest": -0.15,
    "military_loss": -0.20,
    "economic_stress": -0.05,
    "political_instability": -0.10,
    "nationalist_sentiment": 0.10
  }
}
```

The action catalogue is part of the static world. The decision evaluator combines
these weights with the per-region intel to produce a probability and a
breakdown. See [decision-engine.md](./decision-engine.md) for the formula.

## Conventions

- Coordinates are always `[lon, lat]` to match GeoJSON / MapLibre.
- All floats in `[0, 1]` are normalised intensity / share scores. Bilateral relation scores are signed in `[-1, +1]`.
- IDs are namespaced (`city.*`, `unit.<faction>.*`, `terr.*`, `oblast.<iso>.*`, `depot.*`, `afld.*`, `nbase.*`, `cross.*`, `supply.*`, `isr.*`, `msl.*`, `aor.*`, `front.*`) and stable across exports of the same scenario. Country ids are short ISO-style slugs (`ru`, `ua`, `by`, ...).
- `country_id` on `City`, `Territory`, `Unit`, `Oblast` is optional for some, required for `Oblast`. Alliance-only entities omit it where allowed.
- `available_actions` on every entity is a list of affordance ids. v1 surfaces them as disabled buttons; execution lands later.
- Unknown fields must be ignored by the frontend (forward-compatible).
