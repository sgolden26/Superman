"""Demo seed data. Idempotent: skipped when any person already exists.

Re-seeding is a delete-and-restart: remove `data/superman.db` and start the
app. Locations cluster around Brussels city centre so the C2 map has
something to render.
"""
from __future__ import annotations

import logging
import random
from datetime import timedelta

from sqlmodel import Session, select

from app.models import Alignment, HeartbeatReading, Person, Sensor
from app.utils.time import utcnow

_log = logging.getLogger(__name__)

# (name, lat, lon)
_SENSORS: list[tuple[str, float, float]] = [
    ("grand-place-rooftop", 50.8467, 4.3525),
    ("manneken-pis-corner", 50.8451, 4.3499),
    ("central-station",     50.8456, 4.3568),
    ("mont-des-arts",       50.8431, 4.3573),
    ("place-poelaert",      50.8369, 4.3550),
    ("porte-de-namur",      50.8392, 4.3641),
    ("parc-de-bruxelles",   50.8456, 4.3636),
    ("bourse",              50.8489, 4.3493),
]

# (name, fingerprint (32 hex chars), alignment, attributes, reading count)
_PEOPLE: list[tuple[str, str, Alignment, dict[str, object], int]] = [
    # blue — friendly operators
    ("Operator Alpha",   "a1" * 16, Alignment.BLUE,  {"role": "operator", "team": "alpha"}, 22),
    ("Operator Bravo",   "a2" * 16, Alignment.BLUE,  {"role": "operator", "team": "alpha"}, 20),
    ("Operator Charlie", "a3" * 16, Alignment.BLUE,  {"role": "operator", "team": "bravo"}, 18),
    # green — neutral civilians
    ("Civilian Marie",   "b1" * 16, Alignment.GREEN, {"role": "civilian"}, 14),
    ("Civilian Pieter",  "b2" * 16, Alignment.GREEN, {"role": "civilian"}, 12),
    ("Civilian Sophie",  "b3" * 16, Alignment.GREEN, {"role": "civilian"}, 10),
    # red — hostiles
    ("Suspect K1", "c1" * 16, Alignment.RED, {"role": "suspect", "threat": "high"},   16),
    ("Suspect K2", "c2" * 16, Alignment.RED, {"role": "suspect", "threat": "medium"}, 14),
    ("Suspect K3", "c3" * 16, Alignment.RED, {"role": "suspect", "threat": "high"},   11),
    # grey — unidentified (names match the resolver's auto-naming)
    ("unknown-d1d1d1d1", "d1" * 16, Alignment.GREY, {}, 7),
    ("unknown-d2d2d2d2", "d2" * 16, Alignment.GREY, {}, 5),
    ("unknown-d3d3d3d3", "d3" * 16, Alignment.GREY, {}, 9),
    ("unknown-d4d4d4d4", "d4" * 16, Alignment.GREY, {}, 4),
]


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
            closest = min(
                sensors,
                key=lambda s, _lat=lat, _lon=lon: (s.lat - _lat) ** 2 + (s.lon - _lon) ** 2,
            )
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
