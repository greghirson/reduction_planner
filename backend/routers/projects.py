from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse

from backend.models.schemas import ProjectSummary, ProjectDetail
from backend.services import project_manager

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectSummary])
async def list_projects():
    return project_manager.list_projects()


@router.post("", response_model=ProjectDetail)
async def create_project(name: str = Form(...), image: UploadFile = File(...)):
    image_bytes = await image.read()
    meta = project_manager.create_project(name, image_bytes)
    return meta


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(project_id: str):
    meta = project_manager.get_project(project_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Project not found")
    return meta


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    if not project_manager.delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}


@router.get("/{project_id}/images/{filename}")
async def serve_image(project_id: str, filename: str):
    project_dir = project_manager.get_project_dir(project_id)
    if not project_dir:
        raise HTTPException(status_code=404, detail="Project not found")
    # Allow serving from layers/ subdirectory
    if filename.startswith("layer_"):
        file_path = project_dir / "layers" / filename
    else:
        file_path = project_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, media_type="image/png")
