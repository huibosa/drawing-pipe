from __future__ import annotations

import json
from functools import lru_cache
from importlib import resources
from importlib.resources.abc import Traversable

from pydantic import BaseModel, ConfigDict, ValidationError

from drawing_pipe.api.schemas import PipePayload


class TemplateFilePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    version: int = 1
    pipes: list[PipePayload]


def _template_files() -> list[Traversable]:
    data_dir = resources.files("drawing_pipe.templates").joinpath("data")
    if not data_dir.is_dir():
        return []

    return sorted(
        (
            entry
            for entry in data_dir.iterdir()
            if entry.is_file() and entry.name.endswith(".json")
        ),
        key=lambda entry: entry.name,
    )


def _normalized_template_name(template: TemplateFilePayload, filename: str) -> str:
    if template.name and template.name.strip():
        return template.name.strip()
    return filename.rsplit(".", 1)[0].upper()


@lru_cache(maxsize=1)
def load_template_payloads() -> dict[str, list[PipePayload]]:
    templates: dict[str, list[PipePayload]] = {}

    for entry in _template_files():
        try:
            raw = json.loads(entry.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON in template file: {entry.name}") from exc

        try:
            parsed = TemplateFilePayload.model_validate(raw)
        except ValidationError as exc:
            raise ValueError(f"Invalid template schema in file: {entry.name}") from exc
        template_name = _normalized_template_name(parsed, entry.name)

        if template_name in templates:
            raise ValueError(f"Duplicate template name: {template_name}")

        templates[template_name] = parsed.pipes

    return templates
