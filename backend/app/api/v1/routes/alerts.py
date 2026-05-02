"""Alert endpoints."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import get_alerting_service
from app.schemas.alert import AlertAcknowledgeRequest, AlertQuery, AlertRead
from app.services.alerting_service import AlertingService

router = APIRouter()


@router.get("", response_model=list[AlertRead])
async def list_alerts(
    query: AlertQuery = Depends(),
    service: AlertingService = Depends(get_alerting_service),
) -> list[AlertRead]:
    raise NotImplementedError


@router.post("/{alert_id}/ack", response_model=AlertRead)
async def acknowledge_alert(
    alert_id: UUID,
    payload: AlertAcknowledgeRequest,
    service: AlertingService = Depends(get_alerting_service),
) -> AlertRead:
    raise NotImplementedError
