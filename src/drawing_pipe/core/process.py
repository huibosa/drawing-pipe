from drawing_pipe.core.pipes import Pipe

import numpy as np


class Process:
    def __init__(self, pipes: list[Pipe]) -> None:
        self.pipes = pipes


class ProcessAnalysis:
    """Analyzes a sequence of pipe shapes through a manufacturing process."""

    def __init__(self, pipes: list[Pipe]) -> None:
        self.pipes = pipes

    @property
    def area_reductions(self) -> list[float]:
        """Calculate area reduction between consecutive pipes."""
        pipes = self.pipes
        ret: list[float] = []
        for initial, final in zip(pipes[:-1], pipes[1:]):
            reduction = (initial.area - final.area) / initial.area
            ret.append(reduction)
        return ret

    @property
    def eccentricity_diffs(self) -> list[float]:
        """Calculate eccentricity differences between consecutive pipes."""
        pipes = self.pipes
        ret: list[float] = []
        for initial, final in zip(pipes[:-1], pipes[1:]):
            ret.append(final.eccentricity - initial.eccentricity)
        return ret

    @property
    def thickness_reductions(self) -> np.ndarray:
        pipes = self.pipes
        ret: list[np.ndarray] = []
        for initial, final in zip(pipes[:-1], pipes[1:]):
            ret.append((initial.thickness - final.thickness) / initial.thickness)
        return np.array(ret)
