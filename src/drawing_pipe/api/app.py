from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from drawing_pipe.api import domain
from drawing_pipe.api.schemas import AnalyzeResponse, ProfilePayload, TemplatesResponse
from drawing_pipe.core.process import ProcessAnalysis


def _allowed_origins() -> list[str]:
    configured = os.getenv("ALLOWED_ORIGINS", "").strip()
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def create_app() -> FastAPI:
    app = FastAPI(title="Drawing Pipe API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/templates", response_model=TemplatesResponse)
    def list_templates() -> TemplatesResponse:
        return TemplatesResponse(templates=domain.load_templates())

    @app.post("/api/analyze", response_model=AnalyzeResponse)
    def analyze_profile(profile: ProfilePayload) -> AnalyzeResponse:
        pipes = [domain.pipe_from_payload(payload) for payload in profile.pipes]
        analysis = ProcessAnalysis(pipes)
        return AnalyzeResponse(
            area_reductions=analysis.area_reductions,
            eccentricity_diffs=analysis.eccentricity_diffs,
            thickness_reductions=analysis.thickness_reductions.tolist(),
        )

    return app


app = create_app()
