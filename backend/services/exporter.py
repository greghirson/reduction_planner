import io
import zipfile
from pathlib import Path

from backend.services.project_manager import get_project_dir, get_project


def export_zip(project_id: str) -> io.BytesIO:
    project_dir = get_project_dir(project_id)
    meta = get_project(project_id)
    layers_dir = project_dir / "layers"

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Include quantized image
        quantized = project_dir / "quantized.png"
        if quantized.exists():
            zf.write(quantized, "quantized.png")

        # Include all layer images
        for layer_file in sorted(layers_dir.glob("layer_*.png")):
            zf.write(layer_file, f"layers/{layer_file.name}")

    buf.seek(0)
    return buf
