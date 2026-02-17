from __future__ import annotations

from drawing_pipe.api import domain
from drawing_pipe.api.schemas import AnalyzeResponse, ProfilePayload
from drawing_pipe.core.process import ProcessAnalysis


def analyze_profile(profile: ProfilePayload) -> AnalyzeResponse:
    pipes = [domain.pipe_from_payload(payload) for payload in profile.pipes]
    analysis = ProcessAnalysis(pipes)
    return AnalyzeResponse(
        area_reductions=analysis.area_reductions,
        eccentricity_diffs=analysis.eccentricity_diffs,
        thickness_reductions=analysis.thickness_reductions.tolist(),
    )
