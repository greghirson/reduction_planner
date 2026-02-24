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


class QuantizeRequest(BaseModel):
    color_count: int


class LayerRequest(BaseModel):
    order: list[int] | None = None
