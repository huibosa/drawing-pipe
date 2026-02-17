from __future__ import annotations

from fastapi import APIRouter

from drawing_pipe.api.schemas import TemplatesResponse
from drawing_pipe.api.services import template_service

router = APIRouter()


@router.get("/api/templates", response_model=TemplatesResponse)
def list_templates() -> TemplatesResponse:
    return template_service.build_templates_response()
