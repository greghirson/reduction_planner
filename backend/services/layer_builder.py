import json
import shutil

import numpy as np
from PIL import Image

from backend.services.project_manager import get_project_dir, get_project, save_meta


def _luminance(color: list[int]) -> float:
    r, g, b = color
    return 0.299 * r + 0.587 * g + 0.114 * b


def build_layers(project_id: str, order: list[int] | None = None) -> dict:
    project_dir = get_project_dir(project_id)
    palette = json.loads((project_dir / "palette.json").read_text())
    img = Image.open(project_dir / "quantized.png")
    pixels = np.array(img)

    if order is None:
        # Sort by luminance: darkest first (top/detail layer), lightest last (base)
        indexed = list(enumerate(palette))
        indexed.sort(key=lambda x: _luminance(x[1]))
        order = [i for i, _ in indexed]

    sorted_palette = [palette[i] for i in order]

    # Assign each pixel to nearest palette color
    flat = pixels.reshape(-1, 3).astype(np.float64)
    palette_arr = np.array(palette, dtype=np.float64)
    dists = np.linalg.norm(flat[:, None, :] - palette_arr[None, :, :], axis=2)
    labels = dists.argmin(axis=1).reshape(pixels.shape[:2])

    layers_dir = project_dir / "layers"
    if layers_dir.exists():
        shutil.rmtree(layers_dir)
    layers_dir.mkdir()

    n = len(sorted_palette)
    for layer_idx in range(n):
        # Layer layer_idx shows colors from index 0..layer_idx on white
        canvas = np.full_like(pixels, 255)
        for ci in range(layer_idx + 1):
            original_palette_idx = order[ci]
            mask = labels == original_palette_idx
            canvas[mask] = sorted_palette[ci]
        layer_img = Image.fromarray(canvas)
        layer_img.save(layers_dir / f"layer_{layer_idx}.png", "PNG")

    meta = get_project(project_id)
    meta["state"] = "layers_created"
    meta["layer_order"] = order
    meta.pop("layer_count", None)
    save_meta(project_id, meta)
    return get_project(project_id)
