import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import User, current_user
from app.db import get_db
from app.models import Task
from app.schemas import TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _get_owned(db: Session, user: User, task_id: uuid.UUID) -> Task:
    task = db.get(Task, task_id)
    if task is None or task.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return task


@router.get("", response_model=list[TaskOut])
def list_tasks(
    list_id: uuid.UUID | None = None,
    completed: bool | None = None,
    q: str | None = Query(default=None, description="Case-insensitive title search"),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> list[Task]:
    stmt = select(Task).where(Task.user_id == user.id)
    if list_id is not None:
        stmt = stmt.where(Task.list_id == list_id)
    if completed is not None:
        stmt = stmt.where(Task.completed.is_(completed))
    if q:
        stmt = stmt.where(Task.title.ilike(f"%{q}%"))
    stmt = stmt.order_by(Task.completed, Task.position, Task.created_at)
    return list(db.scalars(stmt))


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> Task:
    task = Task(user_id=user.id, **payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> Task:
    return _get_owned(db, user, task_id)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> Task:
    task = _get_owned(db, user, task_id)
    changes = payload.model_dump(exclude_unset=True)

    if "completed" in changes and changes["completed"] != task.completed:
        task.completed_at = datetime.now(timezone.utc) if changes["completed"] else None

    for field, value in changes.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> None:
    db.delete(_get_owned(db, user, task_id))
    db.commit()
