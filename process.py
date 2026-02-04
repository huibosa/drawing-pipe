from pipes import Pipe

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
    def vertex_distances(self) -> list[tuple[float, ...]]:
        pipes = self.pipes
        ret: list[tuple[float, ...]] = []
        for initial, final in zip(pipes[:-1], pipes[1:]):
            tmp1 = np.asarray(initial.vertex_distances)
            tmp2 = np.asarray(final.vertex_distances)

            ret.append(tuple(tmp1 - tmp2))
        return ret
