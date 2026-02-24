import json

import numpy as np
from PIL import Image
from sklearn.cluster import MiniBatchKMeans

from backend.services.project_manager import get_project_dir, get_project, save_meta


def quantize(project_id: str, color_count: int) -> dict:
    project_dir = get_project_dir(project_id)
    img = Image.open(project_dir / "original.png")
    pixels = np.array(img).reshape(-1, 3).astype(np.float64)

    kmeans = MiniBatchKMeans(n_clusters=color_count, random_state=42, n_init=3)
    kmeans.fit(pixels)

    palette = kmeans.cluster_centers_.round().astype(int).tolist()
    labels = kmeans.labels_
    quantized_pixels = np.array(palette)[labels].astype(np.uint8)
    quantized_img = Image.fromarray(quantized_pixels.reshape(img.size[1], img.size[0], 3))
    quantized_img.save(project_dir / "quantized.png", "PNG")

    (project_dir / "palette.json").write_text(json.dumps(palette))

    meta = get_project(project_id)
    meta["state"] = "quantized"
    meta["color_count"] = color_count
    meta["palette"] = palette
    meta.pop("layer_count", None)
    save_meta(project_id, meta)
    return meta
