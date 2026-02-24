from PIL import Image

from backend.services.project_manager import get_project_dir, get_project, save_meta


def crop(project_id: str, x: int, y: int, width: int, height: int) -> dict:
    project_dir = get_project_dir(project_id)
    img = Image.open(project_dir / "original.png")

    box = (x, y, x + width, y + height)
    cropped = img.crop(box)
    cropped.save(project_dir / "cropped.png", "PNG")

    # Remove downstream artifacts so they get regenerated from the crop
    for f in ("quantized.png", "palette.json", "labels.npy"):
        (project_dir / f).unlink(missing_ok=True)
    layers_dir = project_dir / "layers"
    if layers_dir.exists():
        import shutil
        shutil.rmtree(layers_dir)

    meta = get_project(project_id)
    meta["state"] = "cropped"
    meta["color_count"] = None
    meta["palette"] = None
    meta["layer_order"] = None
    meta.pop("layer_count", None)
    save_meta(project_id, meta)
    return meta
