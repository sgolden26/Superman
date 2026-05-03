"""Person resolution from heartbeat fingerprints."""
from __future__ import annotations

from sqlmodel import Session, select

from app.models import Alignment, Person


def find_or_create_by_fingerprint(session: Session, fingerprint: str) -> Person:
    """Return the `Person` for `fingerprint`, creating an unidentified one if new.

    Does not commit. Caller is responsible for the surrounding transaction.
    """
    existing = session.exec(select(Person).where(Person.fingerprint == fingerprint)).first()
    if existing is not None:
        return existing

    person = Person(
        name=f"unknown-{fingerprint[:8]}",
        fingerprint=fingerprint,
        alignment=Alignment.GREY,
    )
    session.add(person)
    session.flush()
    return person
