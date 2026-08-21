import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.services.zoom_webhook_service import ZoomWebhookService, verify_webhook_signature

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/zoom")
async def zoom_webhook(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    body_bytes = await request.body()
    body_text = body_bytes.decode("utf-8")

    try:
        payload_json = json.loads(body_text)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from exc

    event = payload_json.get("event", "")
    payload = payload_json.get("payload") or {}
    settings = get_settings()
    service = ZoomWebhookService(db)

    if event == "endpoint.url_validation":
        try:
            result = service.handle_url_validation(payload)
        except ValueError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        return Response(
            content=json.dumps(result),
            media_type="application/json",
            status_code=200,
        )

    secret = settings.zoom_webhook_secret_token
    if not secret:
        logger.error("Zoom webhook received but ZOOM_WEBHOOK_SECRET_TOKEN is not set")
        raise HTTPException(status_code=503, detail="Zoom webhook secret not configured")

    signature = request.headers.get("x-zm-signature")
    timestamp = request.headers.get("x-zm-request-timestamp")
    if not verify_webhook_signature(
        body=body_text,
        timestamp=timestamp,
        signature=signature,
        secret=secret,
    ):
        logger.warning("Invalid Zoom webhook signature for event %s", event)
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        result = service.handle_event(event, payload)
    except Exception as exc:
        logger.exception("Zoom webhook handler failed for event %s: %s", event, exc)
        raise HTTPException(status_code=500, detail="Webhook processing failed") from exc

    logger.info("Processed Zoom webhook %s: %s", event, result)
    return Response(content=json.dumps({"received": True, **result}), media_type="application/json")
