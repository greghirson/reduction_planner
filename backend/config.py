from pathlib import Path

PROJECTS_DIR = Path(__file__).resolve().parent.parent / "projects_data"
PROJECTS_DIR.mkdir(exist_ok=True)
