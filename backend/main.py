from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend import domain
from backend.schemas import AnalyzeResponse, ProfilePayload, TemplatesResponse
from process import ProcessAnalysis

app = FastAPI(title="Drawing Pipe API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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
