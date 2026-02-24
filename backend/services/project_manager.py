import json
import shutil
import uuid
from pathlib import Path

from PIL import Image, ImageOps

from backend.config import PROJECTS_DIR


def list_projects() -> list[dict]:
    projects = []
    for d in sorted(PROJECTS_DIR.iterdir()):
        meta_path = d / "project.json"
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
            projects.append({"id": meta["id"], "name": meta["name"], "state": meta["state"]})
    return projects


def create_project(name: str, image_bytes: bytes) -> dict:
    project_id = uuid.uuid4().hex
    project_dir = PROJECTS_DIR / project_id
    project_dir.mkdir()

    img = Image.open(__import__("io").BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")
    img.save(project_dir / "original.png", "PNG")

    meta = {
        "id": project_id,
        "name": name,
        "state": "uploaded",
        "color_count": None,
        "palette": None,
        "layer_order": None,
    }
    (project_dir / "project.json").write_text(json.dumps(meta, indent=2))
    return meta


def get_project(project_id: str) -> dict | None:
    meta_path = PROJECTS_DIR / project_id / "project.json"
    if not meta_path.exists():
        return None
    meta = json.loads(meta_path.read_text())
    layers_dir = PROJECTS_DIR / project_id / "layers"
    if layers_dir.exists():
        meta["layer_count"] = len(list(layers_dir.glob("layer_*.png")))
    return meta


def save_meta(project_id: str, meta: dict) -> None:
    meta_path = PROJECTS_DIR / project_id / "project.json"
    meta_path.write_text(json.dumps(meta, indent=2))


def delete_project(project_id: str) -> bool:
    project_dir = PROJECTS_DIR / project_id
    if not project_dir.exists():
        return False
    shutil.rmtree(project_dir)
    return True


def get_project_dir(project_id: str) -> Path | None:
    d = PROJECTS_DIR / project_id
    return d if d.exists() else None
