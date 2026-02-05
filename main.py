"""Example usage of the drawing pipe library."""

import fixtures
from process import ProcessAnalysis


def main():
    print(ProcessAnalysis(fixtures.PROCESS).thickness_reductions)


if __name__ == "__main__":
    main()
