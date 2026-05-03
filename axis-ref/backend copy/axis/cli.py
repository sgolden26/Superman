"""Typer CLI: `python -m axis ...` entry point."""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

import typer

from axis import scenarios
from axis.intel.morale_factors import (
    build_dataset as build_morale_factors_dataset,
    write_dataset as write_morale_factors_dataset,
)
from axis.intel.pipeline import IntelPipeline, build_source, default_region_ids
from axis.serialization.snapshot import SnapshotExporter
from axis.settings import (
    DEFAULT_SETTINGS_PATH,
    Settings,
    load_settings,
    resolve_intel_source,
    save_settings,
)

# Anchor default output paths to the repo root rather than the current working
# directory. The CLI is routinely invoked from either the repo root or the
# `backend/` subdir, and a cwd-relative default like `Path("../data/...")`
# silently writes outside the project when invoked from anywhere else. Using
# `__file__` keeps writes inside `Axis/data/` regardless of cwd.
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_DATA_DIR = _PROJECT_ROOT / "data"

app = typer.Typer(add_completion=False, help="Axis wargame backend CLI.")
intel_app = typer.Typer(add_completion=False, help="Intel / morale pipeline.")
morale_factors_app = typer.Typer(
    add_completion=False,
    help="Per-region troop-morale factor dataset (one-shot live pull).",
)
settings_app = typer.Typer(add_completion=False, help="Backend runtime settings.")
app.add_typer(intel_app, name="intel")
intel_app.add_typer(morale_factors_app, name="morale-factors")
app.add_typer(settings_app, name="settings")


_SOURCE_HELP = "Intel source: auto | curated | gdelt_snapshot | gdelt_live."


@app.callback()
def _root(
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable INFO logs."),
) -> None:
    logging.basicConfig(
        level=logging.INFO if verbose else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )


@app.command()
def export(
    scenario: str = typer.Option(
        "eastern_europe",
        "--scenario",
        "-s",
        help="Scenario id to export.",
    ),
    out: Path = typer.Option(
        _DATA_DIR / "state.json",
        "--out",
        "-o",
        help="Output JSON path. Defaults to <repo>/data/state.json.",
    ),
    intel_out: Path = typer.Option(
        _DATA_DIR / "intel.json",
        "--intel-out",
        help="Where to write intel.json. Pass empty string to skip.",
    ),
    intel_source: str = typer.Option(
        "auto",
        "--source",
        help=_SOURCE_HELP,
    ),
) -> None:
    """Build the named scenario and write JSON snapshots (state + intel)."""
    builder_fn = scenarios.get(scenario)
    theater = builder_fn()
    exporter = SnapshotExporter(theater)
    written = exporter.write(out)
    typer.echo(f"Wrote {written.resolve()}")

    if intel_out and str(intel_out):
        settings = load_settings()
        resolved = resolve_intel_source(intel_source, settings)
        pipeline = IntelPipeline(
            source=build_source(intel_source, settings=settings),
            region_ids=tuple(default_region_ids()),
        )
        intel_path = pipeline.write(intel_out)
        typer.echo(
            f"Wrote {intel_path.resolve()} "
            f"(source={intel_source} -> {resolved}; "
            f"live_news_enabled={settings.live_news_enabled})"
        )


@app.command(name="list")
def list_scenarios() -> None:
    """List available scenario ids."""
    for sid in sorted(scenarios.SCENARIOS):
        typer.echo(sid)


@app.command()
def serve(
    host: str = typer.Option("127.0.0.1", "--host", help="Bind address."),
    port: int = typer.Option(8000, "--port", "-p", help="HTTP port."),
    reload: bool = typer.Option(
        False,
        "--reload",
        help="Enable uvicorn auto-reload (dev only).",
    ),
) -> None:
    """Run the live theatre HTTP service.

    The FE expects this on localhost:8000 and proxies `/api/*` to it during
    `npm run dev`. Holds the theatre in memory; orders mutate that state.

    Auto-loads environment variables from `backend/.env` (and any `.env`
    walked up from cwd) so secrets like `OPENAI_API_KEY` do not have to be
    exported manually.
    """
    _load_dotenv_for_serve()

    import uvicorn  # local import keeps `axis export` cheap to start

    uvicorn.run(
        "axis.server.app:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info",
    )


def _load_dotenv_for_serve() -> None:
    """Load `.env` from cwd and from `backend/.env` next to the package.

    Idempotent and silent. Existing OS env vars win over file values so
    operators can still override per-shell.
    """
    try:
        from dotenv import find_dotenv, load_dotenv
    except ImportError:
        return
    load_dotenv(find_dotenv(usecwd=True), override=False)
    backend_env = Path(__file__).resolve().parents[1] / ".env"
    if backend_env.exists():
        load_dotenv(backend_env, override=False)


@intel_app.command("export")
def intel_export(
    source: str = typer.Option(
        "auto",
        "--source",
        help=_SOURCE_HELP,
    ),
    out: Path = typer.Option(
        _DATA_DIR / "intel.json",
        "--out",
        "-o",
        help="Output intel.json path. Defaults to <repo>/data/intel.json.",
    ),
) -> None:
    """Run the intel pipeline once and write intel.json."""
    settings = load_settings()
    resolved = resolve_intel_source(source, settings)
    pipeline = IntelPipeline(
        source=build_source(source, settings=settings),
        region_ids=tuple(default_region_ids()),
    )
    written = pipeline.write(out)
    typer.echo(
        f"Wrote {written.resolve()} (source={source} -> {resolved}; "
        f"live_news_enabled={settings.live_news_enabled})"
    )


@intel_app.command("tick")
def intel_tick(
    source: str = typer.Option(
        "auto",
        "--source",
        help=_SOURCE_HELP,
    ),
    out: Path = typer.Option(
        _DATA_DIR / "intel.json",
        "--out",
        "-o",
        help="Output intel.json path. Defaults to <repo>/data/intel.json.",
    ),
    interval: float = typer.Option(
        30.0,
        "--interval",
        help="Seconds between writes. Live sources should not poll faster than ~15s.",
    ),
    iterations: int = typer.Option(
        0,
        "--iterations",
        "-n",
        help="Number of ticks before exit. 0 = run forever.",
    ),
    reload_settings: bool = typer.Option(
        True,
        "--reload-settings/--no-reload-settings",
        help=(
            "If true, settings file is re-read on every tick so toggling "
            "live news takes effect without restarting the loop."
        ),
    ),
) -> None:
    """Re-export intel.json on a timer so the FE polling loop sees fresh data."""
    settings = load_settings()
    resolved = resolve_intel_source(source, settings)
    pipeline = IntelPipeline(
        source=build_source(source, settings=settings),
        region_ids=tuple(default_region_ids()),
    )
    seq = 0
    typer.echo(
        f"intel tick: source={source} -> {resolved}, "
        f"live_news_enabled={settings.live_news_enabled}, "
        f"interval={interval}s, out={out}. Ctrl-C to stop."
    )
    try:
        last_resolved = resolved
        while True:
            seq += 1
            if reload_settings:
                next_settings = load_settings()
                next_resolved = resolve_intel_source(source, next_settings)
                if next_resolved != last_resolved or (
                    next_settings.live_news_enabled != settings.live_news_enabled
                ):
                    typer.echo(
                        f"  settings changed -> rebuilding source: "
                        f"{last_resolved} -> {next_resolved} "
                        f"(live_news_enabled={next_settings.live_news_enabled})"
                    )
                    settings = next_settings
                    last_resolved = next_resolved
                    pipeline = IntelPipeline(
                        source=build_source(source, settings=settings),
                        region_ids=tuple(default_region_ids()),
                    )

            now = datetime.now(tz=timezone.utc)
            try:
                pipeline.write(out, now=now, tick_seq=seq)
                typer.echo(
                    f"  [{now.isoformat()}] tick #{seq} written "
                    f"(source={pipeline.source.name})"
                )
            except Exception as exc:  # noqa: BLE001 - keep loop alive
                typer.echo(
                    f"  [{now.isoformat()}] tick #{seq} FAILED: {exc}",
                    err=True,
                )
            if iterations and seq >= iterations:
                return
            time.sleep(interval)
    except KeyboardInterrupt:
        typer.echo("intel tick: stopped.")


# ---------- intel morale-factors ----------


@morale_factors_app.command("pull")
def morale_factors_pull(
    out: Path = typer.Option(
        _DATA_DIR / "morale_factors.json",
        "--out",
        "-o",
        help="Output morale_factors.json path.",
    ),
    lookback_hours: int = typer.Option(
        72,
        "--lookback-hours",
        help="GDELT timespan per call (hours).",
    ),
    records_per_batch: int = typer.Option(
        75,
        "--records-per-batch",
        help=(
            "Articles fetched per (region, keyword-batch). The dataset "
            "issues 4 regions x 3 batches = 12 calls per pull; articles "
            "are merged & multi-label classified across all 12 scorable "
            "factor rows."
        ),
    ),
    timeout_s: float = typer.Option(
        90.0,
        "--timeout",
        help="HTTP timeout per call (seconds). GDELT can be slow under load.",
    ),
    inter_call_delay_s: float = typer.Option(
        2.0,
        "--inter-call-delay",
        help=(
            "Seconds of pause between GDELT calls. Keeps the free-tier "
            "rate limiter happy; raise if you see 429s."
        ),
    ),
) -> None:
    """Hit GDELT live in batches and write the morale-factors dataset.

    This command intentionally ignores the `live_news_enabled` setting:
    it is a one-shot, on-demand pull. The follow-up "refresh on region
    click" path will gate itself on the toggle separately.
    """
    typer.echo(
        f"morale-factors pull: batched GDELT fetch "
        f"(lookback={lookback_hours}h, records_per_batch={records_per_batch}, "
        f"timeout={timeout_s}s, inter_call_delay={inter_call_delay_s}s)..."
    )
    dataset = build_morale_factors_dataset(
        lookback_hours=lookback_hours,
        records_per_batch=records_per_batch,
        timeout_s=timeout_s,
        inter_call_delay_s=inter_call_delay_s,
    )
    written = write_morale_factors_dataset(dataset, out)
    n_regions = len(dataset.regions)
    n_scored = sum(
        1
        for r in dataset.regions
        for f in r.factors
        if f.score is not None
    )
    n_total = sum(len(r.factors) for r in dataset.regions)
    n_with_sources = sum(
        1
        for r in dataset.regions
        for f in r.factors
        if len(f.sources) > 0
    )
    n_articles = sum(r.article_count for r in dataset.regions)
    typer.echo(
        f"Wrote {written.resolve()} "
        f"(regions={n_regions}, scored cells={n_scored}/{n_total}, "
        f"cells with sources={n_with_sources}, total articles={n_articles})"
    )


# ---------- settings ----------


@settings_app.command("show")
def settings_show() -> None:
    """Print the current settings and the path they were loaded from."""
    settings = load_settings()
    typer.echo(f"path: {DEFAULT_SETTINGS_PATH}")
    typer.echo(f"exists: {DEFAULT_SETTINGS_PATH.exists()}")
    typer.echo(json.dumps(settings.to_dict(), indent=2))


@settings_app.command("live-news")
def settings_live_news(
    state: str = typer.Argument(
        ...,
        help="on | off | status",
        metavar="STATE",
    ),
) -> None:
    """Toggle the live news (GDELT) master switch."""
    state = state.lower()
    settings = load_settings()
    if state == "status":
        typer.echo(f"live_news_enabled: {settings.live_news_enabled}")
        typer.echo(
            f"intel pipeline 'auto' -> "
            f"{resolve_intel_source('auto', settings)}"
        )
        return
    if state in ("on", "true", "enable", "enabled", "1"):
        settings.live_news_enabled = True
    elif state in ("off", "false", "disable", "disabled", "0"):
        settings.live_news_enabled = False
    else:
        raise typer.BadParameter(f"unknown state {state!r}; use on | off | status.")
    path = save_settings(settings)
    typer.echo(
        f"live_news_enabled = {settings.live_news_enabled} (wrote {path.resolve()})"
    )


@settings_app.command("set")
def settings_set(
    key: str = typer.Argument(..., help="Setting key (e.g. gdelt_lookback_hours)."),
    value: str = typer.Argument(..., help="Value, JSON-encoded for non-strings."),
) -> None:
    """Set an arbitrary setting key. Booleans accept on/off/true/false."""
    settings = load_settings()
    raw = settings.to_dict()
    if key not in raw:
        raise typer.BadParameter(
            f"unknown key {key!r}. Known keys: {', '.join(sorted(raw))}."
        )
    coerced = _coerce_setting_value(raw[key], value)
    raw[key] = coerced
    new_settings = Settings.from_dict(raw)
    path = save_settings(new_settings)
    typer.echo(f"{key} = {coerced!r} (wrote {path.resolve()})")


def _coerce_setting_value(current: object, raw: str) -> object:
    """Coerce a string CLI arg to the type of the existing setting value."""
    if isinstance(current, bool):
        low = raw.strip().lower()
        if low in ("1", "true", "on", "yes", "enable", "enabled"):
            return True
        if low in ("0", "false", "off", "no", "disable", "disabled"):
            return False
        raise typer.BadParameter(f"could not coerce {raw!r} to bool")
    if isinstance(current, int):
        return int(raw)
    if isinstance(current, float):
        return float(raw)
    return raw


def main() -> None:
    app()


if __name__ == "__main__":
    main()
