from typing import List, Tuple

from pipes import Pipe


class ProcessPipeline:
    """Analyzes a sequence of pipe shapes through a manufacturing process."""

    def __init__(self, *shapes: Pipe) -> None:
        self.shapes = shapes

    @property
    def area_reductions(self) -> List[float]:
        """Calculate area reduction between consecutive pipes."""
        shapes = self.shapes
        ret: List[float] = []
        for initial, final in zip(shapes[:-1], shapes[1:]):
            reduction = (initial.area - final.area) / initial.area
            ret.append(reduction)
        return ret

    @property
    def eccentricity_diffs(self) -> List[float]:
        """Calculate eccentricity differences between consecutive pipes."""
        shapes = self.shapes
        ret: List[float] = []
        for initial, final in zip(shapes[:-1], shapes[1:]):
            ret.append(initial.eccentricity - final.eccentricity)
        return ret
