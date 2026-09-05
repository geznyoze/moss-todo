import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class TaskListCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    color: str | None = Field(default=None, max_length=32)
    position: int = 0


class TaskListUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    color: str | None = Field(default=None, max_length=32)
    position: int | None = None


class TaskListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str | None
    position: int
    created_at: datetime
    updated_at: datetime


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    notes: str | None = None
    list_id: uuid.UUID | None = None
    due_date: date | None = None
    priority: int = 0
    position: int = 0


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    notes: str | None = None
    list_id: uuid.UUID | None = None
    completed: bool | None = None
    due_date: date | None = None
    priority: int | None = None
    position: int | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    list_id: uuid.UUID | None
    title: str
    notes: str | None
    completed: bool
    completed_at: datetime | None
    due_date: date | None
    priority: int
    position: int
    created_at: datetime
    updated_at: datetime
