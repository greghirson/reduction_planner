from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import projects, processing

app = FastAPI(title="Reduction Print Designer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(processing.router)
