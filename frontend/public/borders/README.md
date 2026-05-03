# Border assets

Filtered Natural Earth GeoJSON, shipped statically and merged with scenario
data at runtime by `frontend/src/data/loadBorders.ts`.

## Files

| File | Source | Notes |
|---|---|---|
| `admin0_primary.geojson` | NE 50m admin_0_countries | Primary belligerents and adjacent states (RU, UA, BY, PL, MD, RO, GE). |
| `admin0_context.geojson` | NE 50m admin_0_countries | Wider context ring used for muted neighbour fills. |
| `admin1_ua.geojson` | NE 10m admin_1_states_provinces | Ukraine's 24 oblasts, AR Crimea, Sevastopol, Kyiv City. Contested features carry `properties.contested = true`. |

Properties are stripped to the minimum the frontend needs:

```jsonc
// admin0_*
{ "iso_a3": "UKR", "iso_a2": "UA", "name": "Ukraine", "name_long": "Ukraine" }

// admin1_ua
{ "iso_a3": "UKR", "iso_3166_2": "UA-30", "oblast_code": "30",
  "name": "Kiev City", "type_en": "Municipality", "contested": false }
```

Source: <https://github.com/nvkelso/natural-earth-vector> (public domain).
