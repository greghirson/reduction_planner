from pydantic import BaseModel


class ProjectSummary(BaseModel):
    id: str
    name: str
    state: str


class ProjectDetail(BaseModel):
    id: str
    name: str
    state: str
    color_count: int | None = None
    palette: list[list[int]] | None = None
    layer_order: list[int] | None = None
    layer_count: int | None = None
    h_flip: bool | None = None
    v_flip: bool | None = None


class CropRequest(BaseModel):
    x: int
    y: int
    width: int
    height: int


class QuantizeRequest(BaseModel):
    color_count: int


class PaletteUpdateRequest(BaseModel):
    palette: list[list[int]]


class FlipRequest(BaseModel):
    horizontal: bool = False
    vertical: bool = False


class LayerRequest(BaseModel):
    order: list[int] | None = None
