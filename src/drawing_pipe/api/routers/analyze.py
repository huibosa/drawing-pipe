from __future__ import annotations

from fastapi import APIRouter

from drawing_pipe.api.schemas import AnalyzeResponse, ProfilePayload
from drawing_pipe.api.services import analysis_service

router = APIRouter()


@router.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_profile(profile: ProfilePayload) -> AnalyzeResponse:
    return analysis_service.analyze_profile(profile)
