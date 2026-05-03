"""Bilateral credibility tracker.

Pure functions plus a small `CredibilityEngine` that owns the mutable list of
tracks on a `Theater`. The engine is invoked from the sim hook on every
`apply_batch` call: it observes a signal-vs-action gap from the issuing
faction and updates every outgoing track from that faction.

Two-track design (Paper 2: Payne 2026):

- `immediate`: rolling signal-action consistency. Updates fast, decays fast.
- `resolve`: long-range follow-through. Updates slowly, decays slowly.

Sign conventions (severity is signed `[-1, +1]`, Goldstein/10 aligned):

- More negative severity = more aggressive action / signal.
- `gap = action_severity - signal_severity`. Positive `gap` means the actor
  was less aggressive than they signalled (they backed down). Negative `gap`
  means they were more aggressive than they signalled (they exceeded their
  threats).
- The credibility update is symmetric around zero: the smaller the absolute
  gap, the better the immediate score gets. Large gaps in either direction
  hurt immediate credibility (you said one thing and did another).
- `resolve` rises when actions are at least as aggressive as signals (the
  actor follows through on threats), and falls when they fall short. This
  rewards consistency in the threatening direction specifically.
"""

from __future__ import annotations

from dataclasses import replace

from axis.domain.political import CredibilityTrack, GapEvent
from axis.domain.theater import Theater


# Tunables. Hackathon-scale values; the goal is visible movement turn-on-turn.
IMMEDIATE_LEARN_RATE = 0.45
IMMEDIATE_DECAY = 0.10  # decay toward zero per turn (no observation)
RESOLVE_LEARN_RATE = 0.18
RESOLVE_DECAY = 0.04
HISTORY_CAP = 8
SIGNIFICANT_GAP = 0.05


def _clamp_signed(value: float) -> float:
    return max(-1.0, min(1.0, value))


def _consistency_score(gap: float) -> float:
    """Map an absolute gap on [-2, 2] to a signed consistency score on [-1, 1].

    Zero gap → +1 (perfectly consistent). |gap| = 1.0 → 0. |gap| = 2.0 → -1.
    """
    return _clamp_signed(1.0 - abs(gap))


def _follow_through_score(gap: float) -> float:
    """Reward following through on threats; penalise backing down.

    Negative gap (acted more aggressively than signalled) → +score (follow
    through, even exceed). Positive gap (backed off) → −score.
    """
    return _clamp_signed(-gap)


def update_track(
    track: CredibilityTrack,
    *,
    signal_severity: float,
    action_severity: float,
    turn: int,
    source: str,
    note: str = "",
) -> CredibilityTrack:
    """Apply a single signal/action observation to a track."""
    gap = action_severity - signal_severity
    immediate_target = _consistency_score(gap)
    resolve_target = _follow_through_score(gap)

    new_immediate = _clamp_signed(
        track.immediate + IMMEDIATE_LEARN_RATE * (immediate_target - track.immediate)
    )
    new_resolve = _clamp_signed(
        track.resolve + RESOLVE_LEARN_RATE * (resolve_target - track.resolve)
    )

    event = GapEvent(
        turn=turn,
        signal_severity=signal_severity,
        action_severity=action_severity,
        gap=gap,
        source=source,
        note=note,
    )
    history = (*track.history, event)[-HISTORY_CAP:]
    return replace(
        track,
        immediate=new_immediate,
        resolve=new_resolve,
        last_updated_turn=turn,
        history=history,
    )


def decay_track(track: CredibilityTrack, *, turn: int) -> CredibilityTrack:
    """Pull a track toward zero when no observation arrived this turn."""
    new_immediate = _clamp_signed(track.immediate * (1.0 - IMMEDIATE_DECAY))
    new_resolve = _clamp_signed(track.resolve * (1.0 - RESOLVE_DECAY))
    return replace(
        track,
        immediate=new_immediate,
        resolve=new_resolve,
        last_updated_turn=turn,
    )


class CredibilityEngine:
    """Mutates the credibility tracks on a `Theater` in place.

    Keeps the algorithm separate from the data shape and from the HTTP layer.
    The simulation hook calls `record_action` once per `apply_batch`.
    """

    def __init__(self, theater: Theater) -> None:
        self._theater = theater

    def record_action(
        self,
        *,
        issuer_faction_id: str,
        signal_severity: float,
        action_severity: float,
        turn: int,
        source: str = "cart_vs_execute",
        note: str = "",
    ) -> list[CredibilityTrack]:
        """Update every outgoing track from `issuer_faction_id`.

        Returns the list of tracks that were updated (callers can log them).
        Tracks not originating from `issuer_faction_id` get a decay step on
        the same turn so the whole layer stays time-coherent.
        """
        if abs(action_severity - signal_severity) < SIGNIFICANT_GAP:
            updated_kind = "decay-only"
        else:
            updated_kind = "applied"
        updated: list[CredibilityTrack] = []
        new_tracks: list[CredibilityTrack] = []
        for track in self._theater.credibility:
            if track.from_faction_id == issuer_faction_id:
                if updated_kind == "applied":
                    nt = update_track(
                        track,
                        signal_severity=signal_severity,
                        action_severity=action_severity,
                        turn=turn,
                        source=source,
                        note=note,
                    )
                    updated.append(nt)
                else:
                    nt = decay_track(track, turn=turn)
            else:
                nt = decay_track(track, turn=turn)
            new_tracks.append(nt)
        self._theater.credibility = new_tracks
        return updated

    def lookup(
        self, *, from_faction_id: str, to_faction_id: str
    ) -> CredibilityTrack | None:
        for t in self._theater.credibility:
            if t.from_faction_id == from_faction_id and t.to_faction_id == to_faction_id:
                return t
        return None
