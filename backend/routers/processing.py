from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.models.schemas import CropRequest, QuantizeRequest, PaletteUpdateRequest, LayerRequest, ProjectDetail
from backend.services import project_manager, quantizer, layer_builder, exporter, cropper

router = APIRouter(prefix="/api/projects", tags=["processing"])


@router.post("/{project_id}/crop", response_model=ProjectDetail)
async def crop(project_id: str, req: CropRequest):
    if not project_manager.get_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    meta = cropper.crop(project_id, req.x, req.y, req.width, req.height)
    return meta


@router.post("/{project_id}/quantize", response_model=ProjectDetail)
async def quantize(project_id: str, req: QuantizeRequest):
    if not project_manager.get_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    if not 2 <= req.color_count <= 12:
        raise HTTPException(status_code=400, detail="color_count must be 2-12")
    meta = quantizer.quantize(project_id, req.color_count)
    return meta


@router.put("/{project_id}/palette", response_model=ProjectDetail)
async def update_palette(project_id: str, req: PaletteUpdateRequest):
    meta = project_manager.get_project(project_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Project not found")
    if meta["state"] not in ("quantized", "layers_created"):
        raise HTTPException(status_code=400, detail="Must quantize first")
    if len(req.palette) != meta["color_count"]:
        raise HTTPException(status_code=400, detail="Palette size must match color_count")
    result = quantizer.replace_palette(project_id, req.palette)
    return result


@router.post("/{project_id}/layers", response_model=ProjectDetail)
async def create_layers(project_id: str, req: LayerRequest | None = None):
    meta = project_manager.get_project(project_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Project not found")
    if meta["state"] not in ("quantized", "layers_created"):
        raise HTTPException(status_code=400, detail="Must quantize first")
    order = req.order if req else None
    result = layer_builder.build_layers(project_id, order)
    return result


@router.get("/{project_id}/export")
async def export(project_id: str):
    meta = project_manager.get_project(project_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Project not found")
    if meta["state"] != "layers_created":
        raise HTTPException(status_code=400, detail="Must create layers first")
    buf = exporter.export_zip(project_id)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={meta['name']}_layers.zip"},
    )
