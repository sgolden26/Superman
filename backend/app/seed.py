"""Demo seed data. Idempotent: skipped when any person already exists.

Re-seeding is a delete-and-restart: remove `data/superman.db` and start the
app. The scene is set inside NTC Fort Irwin's training "box" (Mojave
Desert) so the C2 map renders a plausible US military training environment
with friendly squads, partner force, OPFOR / HVTs, and unidentified
contacts.
"""
from __future__ import annotations

import logging
import random
from datetime import timedelta

from sqlmodel import Session, select

from app.models import Alignment, HeartbeatReading, Person, Sensor
from app.utils.time import utcnow

_log = logging.getLogger(__name__)

# (name, lat, lon) — sensors spread across NTC Fort Irwin's training box
_SENSORS: list[tuple[str, float, float]] = [
    ("razish-mout",          35.332, -116.742),
    ("razish-south-op",      35.305, -116.738),
    ("razish-north-op",      35.355, -116.745),
    ("wadi-overwatch",       35.318, -116.760),
    ("wadi-east-checkpoint", 35.325, -116.705),
    ("ridge-tiefort",        35.350, -116.715),
    ("lz-eagle",             35.310, -116.720),
    ("ecp-bravo",            35.298, -116.732),
]

# (name, fingerprint (32 hex chars), alignment, attributes, reading count)
_PEOPLE: list[tuple[str, str, Alignment, dict[str, object], int]] = [
    # blue — friendly squads
    ("Reaper 1-1", "a1" * 16, Alignment.BLUE,
     {"role": "squad_leader", "squad": "Reaper 1", "rank": "SSG"}, 22),
    ("Reaper 1-2", "a2" * 16, Alignment.BLUE,
     {"role": "rifleman", "squad": "Reaper 1", "rank": "SGT"}, 20),
    ("Reaper 2-1", "a3" * 16, Alignment.BLUE,
     {"role": "squad_leader", "squad": "Reaper 2", "rank": "SSG"}, 18),
    # green — partner force / non-combatants
    ("Partner Force Lead", "b1" * 16, Alignment.GREEN, {"role": "partner_force"}, 14),
    ("Interpreter Tango",  "b2" * 16, Alignment.GREEN, {"role": "interpreter"},   12),
    ("Local Liaison",      "b3" * 16, Alignment.GREEN, {"role": "civilian_lead"}, 10),
    # red — opfor / hvt
    ("OPFOR-1", "c1" * 16, Alignment.RED, {"role": "opfor", "threat": "high"},   16),
    ("HVT-1",   "c2" * 16, Alignment.RED, {"role": "hvt",   "threat": "high"},   14),
    ("HVT-2",   "c3" * 16, Alignment.RED, {"role": "hvt",   "threat": "medium"}, 11),
    # grey — unidentified contacts (names match the resolver's auto-naming)
    ("unknown-d1d1d1d1", "d1" * 16, Alignment.GREY, {}, 7),
    ("unknown-d2d2d2d2", "d2" * 16, Alignment.GREY, {}, 5),
    ("unknown-d3d3d3d3", "d3" * 16, Alignment.GREY, {}, 9),
    ("unknown-d4d4d4d4", "d4" * 16, Alignment.GREY, {}, 4),
]


def _dist_sq(sensor: Sensor, lat: float, lon: float) -> float:
    return (sensor.lat - lat) ** 2 + (sensor.lon - lon) ** 2


def seed_demo_data(session: Session) -> bool:
    """Populate the database with demo sensors, people and readings.

    Returns True if seeding ran, False if the DB was already populated.
    """
    if session.exec(select(Person).limit(1)).first() is not None:
        return False

    sensors = [Sensor(name=name, lat=lat, lon=lon) for name, lat, lon in _SENSORS]
    session.add_all(sensors)
    session.flush()

    rng = random.Random(1729)
    now = utcnow()
    total_readings = 0

    for name, fingerprint, alignment, attributes, n_readings in _PEOPLE:
        person = Person(
            name=name,
            fingerprint=fingerprint,
            alignment=alignment,
            attributes=attributes,
        )
        session.add(person)
        session.flush()
        assert person.id is not None

        # start each person near a randomly chosen sensor and let them drift
        start = sensors[rng.randrange(len(sensors))]
        lat, lon = start.lat, start.lon

        for i in range(n_readings):
            lat += rng.uniform(-8e-4, 8e-4)
            lon += rng.uniform(-8e-4, 8e-4)
            height = round(rng.uniform(1.55, 1.92), 2)
            closest = min(sensors, key=lambda s: _dist_sq(s, lat, lon))
            assert closest.id is not None
            minutes_ago = (n_readings - i) * 2 + rng.uniform(0, 1.5)
            session.add(
                HeartbeatReading(
                    sensor_id=closest.id,
                    person_id=person.id,
                    lat=lat,
                    lon=lon,
                    height=height,
                    captured_at=now - timedelta(minutes=minutes_ago),
                )
            )
            total_readings += 1

    session.commit()
    _log.info(
        "seeded %d sensors, %d people, %d readings",
        len(sensors),
        len(_PEOPLE),
        total_readings,
    )
    return True
