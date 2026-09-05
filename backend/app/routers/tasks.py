import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import User, current_user
from app.db import get_db
from app.models import Task
from app.schemas import TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _owned(db: Session, user: User, task_id: uuid.UUID) -> Task:
    task = db.get(Task, task_id)
    if task is None or task.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return task


@router.get("", response_model=list[TaskOut])
def list_tasks(db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[Task]:
    """Every task for the user. Scopes, views and search are client-side."""
    stmt = select(Task).where(Task.user_id == user.id).order_by(Task.position, Task.created_at)
    return list(db.scalars(stmt))


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> Task:
    task = Task(user_id=user.id, **payload.model_dump(mode="json"))
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> Task:
    task = _owned(db, user, task_id)
    for field, value in payload.model_dump(mode="json", exclude_unset=True).items():
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
    db.delete(_owned(db, user, task_id))
    db.commit()
