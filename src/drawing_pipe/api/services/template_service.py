from __future__ import annotations

from drawing_pipe.api import domain
from drawing_pipe.api.schemas import TemplatesResponse


def build_templates_response() -> TemplatesResponse:
    return TemplatesResponse(templates=domain.load_templates())
