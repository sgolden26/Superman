# data/

Generated scenario snapshots for **Superman** live here. Regenerate with:

```bash
cd backend && python -m superman export --scenario eastern_europe --out ../data/state.json
```

The frontend's `predev` script copies `state.json` from this directory into `frontend/public/` (and optionally `intel.json`).
