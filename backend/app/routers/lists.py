import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import User, current_user
from app.db import get_db
from app.models import TaskList
from app.schemas import ListCreate, ListOut, ListUpdate

router = APIRouter(prefix="/api/lists", tags=["lists"])


def _owned(db: Session, user: User, list_id: uuid.UUID) -> TaskList:
    task_list = db.get(TaskList, list_id)
    if task_list is None or task_list.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "List not found")
    return task_list


@router.get("", response_model=list[ListOut])
def list_lists(db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[TaskList]:
    stmt = (
        select(TaskList)
        .where(TaskList.user_id == user.id)
        .order_by(TaskList.position, TaskList.created_at)
    )
    return list(db.scalars(stmt))


@router.post("", response_model=ListOut, status_code=status.HTTP_201_CREATED)
def create_list(
    payload: ListCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> TaskList:
    task_list = TaskList(user_id=user.id, **payload.model_dump())
    db.add(task_list)
    db.commit()
    db.refresh(task_list)
    return task_list


@router.patch("/{list_id}", response_model=ListOut)
def update_list(
    list_id: uuid.UUID,
    payload: ListUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> TaskList:
    task_list = _owned(db, user, list_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task_list, field, value)
    db.commit()
    db.refresh(task_list)
    return task_list


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list(
    list_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> None:
    db.delete(_owned(db, user, list_id))
    db.commit()
