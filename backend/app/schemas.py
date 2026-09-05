import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Priority = Literal["none", "low", "med", "high"]
Status = Literal["backlog", "next", "doing", "done"]
Recurring = Literal["none", "daily", "weekly", "monthly"]


class Subtask(BaseModel):
    id: str = Field(max_length=64)
    title: str = Field(min_length=1, max_length=500)
    done: bool = False


class ListCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    hue: int = Field(default=96, ge=0, le=359)
    groups: list[str] = Field(default_factory=list, max_length=50)
    position: float = 0


class ListUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    hue: int | None = Field(default=None, ge=0, le=359)
    groups: list[str] | None = Field(default=None, max_length=50)
    position: float | None = None


class ListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    hue: int
    groups: list[str]
    position: float
    created_at: datetime
    updated_at: datetime


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    list_id: uuid.UUID | None = None
    group_name: str = Field(default="", max_length=120)
    notes: str = ""
    # Present so duplicating a finished task keeps it finished.
    done: bool = False
    due: date | None = None
    due_time: time | None = None
    priority: Priority = "none"
    status: Status = "backlog"
    recurring: Recurring = "none"
    color_h: int = Field(default=96, ge=0, le=359)
    color_s: int = Field(default=40, ge=0, le=100)
    color_l: int = Field(default=46, ge=0, le=100)
    subtasks: list[Subtask] = Field(default_factory=list, max_length=100)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    list_id: uuid.UUID | None = None
    group_name: str | None = Field(default=None, max_length=120)
    notes: str | None = None
    done: bool | None = None
    due: date | None = None
    due_time: time | None = None
    priority: Priority | None = None
    status: Status | None = None
    recurring: Recurring | None = None
    color_h: int | None = Field(default=None, ge=0, le=359)
    color_s: int | None = Field(default=None, ge=0, le=100)
    color_l: int | None = Field(default=None, ge=0, le=100)
    subtasks: list[Subtask] | None = Field(default=None, max_length=100)


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    list_id: uuid.UUID | None
    group_name: str
    title: str
    notes: str
    done: bool
    due: date | None
    due_time: time | None
    priority: Priority
    status: Status
    recurring: Recurring
    color_h: int
    color_s: int
    color_l: int
    subtasks: list[Subtask]
    created_at: datetime
    updated_at: datetime
