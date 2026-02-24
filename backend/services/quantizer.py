import json

import numpy as np
from PIL import Image
from sklearn.cluster import MiniBatchKMeans

from backend.services.project_manager import get_project_dir, get_project, save_meta


WHITE = [255, 255, 255]


def quantize(project_id: str, color_count: int) -> dict:
    project_dir = get_project_dir(project_id)
    source = project_dir / "cropped.png"
    if not source.exists():
        source = project_dir / "original.png"
    img = Image.open(source)
    pixels = np.array(img).reshape(-1, 3).astype(np.float64)

    # Cluster into N-1 colors, then add white as the fixed base layer
    n_clusters = max(color_count - 1, 1)
    kmeans = MiniBatchKMeans(n_clusters=n_clusters, random_state=42, n_init=3)
    kmeans.fit(pixels)

    palette = kmeans.cluster_centers_.round().astype(int).tolist()
    palette.append(WHITE)
    white_idx = len(palette) - 1

    # Assign each pixel to nearest palette color (including white)
    palette_arr = np.array(palette, dtype=np.float64)
    dists = np.linalg.norm(pixels[:, None, :] - palette_arr[None, :, :], axis=2)
    labels = dists.argmin(axis=1)

    quantized_pixels = np.array(palette)[labels].astype(np.uint8)
    quantized_img = Image.fromarray(quantized_pixels.reshape(img.size[1], img.size[0], 3))
    quantized_img.save(project_dir / "quantized.png", "PNG")

    (project_dir / "palette.json").write_text(json.dumps(palette))

    # Save labels so palette replacement doesn't need to re-run k-means
    np.save(project_dir / "labels.npy", labels.reshape(img.size[1], img.size[0]))

    meta = get_project(project_id)
    meta["state"] = "quantized"
    meta["color_count"] = color_count
    meta["palette"] = palette
    meta.pop("layer_count", None)
    save_meta(project_id, meta)
    return meta


def replace_palette(project_id: str, new_palette: list[list[int]]) -> dict:
    project_dir = get_project_dir(project_id)
    meta = get_project(project_id)

    labels = np.load(project_dir / "labels.npy")
    palette_arr = np.array(new_palette, dtype=np.uint8)
    quantized_pixels = palette_arr[labels]
    quantized_img = Image.fromarray(quantized_pixels)
    quantized_img.save(project_dir / "quantized.png", "PNG")

    (project_dir / "palette.json").write_text(json.dumps(new_palette))

    meta["palette"] = new_palette
    meta.pop("layer_count", None)
    save_meta(project_id, meta)
    return meta
