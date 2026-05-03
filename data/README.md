# data/

Generated scenario snapshots for **Superman** live here. Regenerate with:

```bash
cd "backend axis" && python -m superman export --scenario eastern_europe --out ../data/state.json
```

The `axis` frontend's `predev` script copies `state.json` from this directory into `axis/public/` (and optionally `intel.json`).
