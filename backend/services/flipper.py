import shutil

from PIL import Image

from backend.services.project_manager import get_project_dir, get_project, save_meta


def flip(project_id: str, horizontal: bool, vertical: bool) -> dict:
    project_dir = get_project_dir(project_id)
    meta = get_project(project_id)
    flipped_path = project_dir / "flipped.png"

    if not horizontal and not vertical:
        # No flip — remove flipped image if it exists
        if flipped_path.exists():
            flipped_path.unlink()
        meta.pop("h_flip", None)
        meta.pop("v_flip", None)
        save_meta(project_id, meta)
        _clear_layers(project_dir, meta, project_id)
        return meta

    img = Image.open(project_dir / "quantized.png")
    if horizontal:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    if vertical:
        img = img.transpose(Image.FLIP_TOP_BOTTOM)
    img.save(flipped_path, "PNG")

    meta["h_flip"] = horizontal
    meta["v_flip"] = vertical
    save_meta(project_id, meta)
    _clear_layers(project_dir, meta, project_id)
    return meta


def _clear_layers(project_dir, meta: dict, project_id: str):
    layers_dir = project_dir / "layers"
    if layers_dir.exists():
        shutil.rmtree(layers_dir)
    if meta.get("state") == "layers_created":
        meta["state"] = "quantized"
        meta.pop("layer_order", None)
        meta.pop("layer_count", None)
        save_meta(project_id, meta)
