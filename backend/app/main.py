from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import User, current_user
from app.config import get_settings
from app.routers import lists, tasks

settings = get_settings()

app = FastAPI(title="Moss Todo API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router)
app.include_router(lists.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/me", tags=["meta"])
def me(user: User = Depends(current_user)) -> dict[str, str | None]:
    return {"id": user.id, "username": user.username, "email": user.email}
