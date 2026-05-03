"""People: manually register or update a person tied to a heartbeat fingerprint."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.exceptions import ConflictError, NotFoundError
from app.db import get_session
from app.models import Alignment, Person

router = APIRouter(prefix="/people", tags=["people"])


class PersonCreate(BaseModel):
    name: str
    fingerprint: str
    alignment: Alignment = Alignment.GREY
    attributes: dict[str, Any] = {}


class PersonUpdate(BaseModel):
    name: str | None = None
    alignment: Alignment | None = None
    attributes: dict[str, Any] | None = None


@router.get("", response_model=list[Person])
def list_people(session: Session = Depends(get_session)) -> list[Person]:
    """All known people, ordered by id."""
    return list(session.exec(select(Person).order_by(Person.id)))


@router.post("", response_model=Person, status_code=status.HTTP_201_CREATED)
def create_person(
    payload: PersonCreate,
    session: Session = Depends(get_session),
) -> Person:
    """Register a person and their fingerprint. Fingerprint must be unique."""
    if session.exec(select(Person).where(Person.fingerprint == payload.fingerprint)).first():
        raise ConflictError(f"fingerprint {payload.fingerprint} already registered")
    person = Person(**payload.model_dump())
    session.add(person)
    session.commit()
    session.refresh(person)
    return person


@router.get("/{person_id}", response_model=Person)
def get_person(person_id: int, session: Session = Depends(get_session)) -> Person:
    """One person by id."""
    person = session.get(Person, person_id)
    if person is None:
        raise NotFoundError(f"person {person_id} not found")
    return person


@router.patch("/{person_id}", response_model=Person)
def update_person(
    person_id: int,
    payload: PersonUpdate,
    session: Session = Depends(get_session),
) -> Person:
    """Patch name, alignment, or attributes. Fingerprint is immutable."""
    person = session.get(Person, person_id)
    if person is None:
        raise NotFoundError(f"person {person_id} not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(person, field, value)
    session.add(person)
    session.commit()
    session.refresh(person)
    return person
