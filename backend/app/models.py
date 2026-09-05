import uuid
from datetime import date, datetime, time
from typing import Any

from sqlalchemy import (
    ARRAY,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    """A local account. Passwords are argon2 hashes; there is no other identity source."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TaskList(Base):
    """A user-owned list. `groups` are just names — a task's `group_name` matches one."""

    __tablename__ = "task_lists"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    hue: Mapped[int] = mapped_column(Integer, nullable=False, default=96)
    groups: Mapped[list[str]] = mapped_column(ARRAY(String(120)), nullable=False, default=list)
    position: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    tasks: Mapped[list["Task"]] = relationship(back_populates="list", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    list_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("task_lists.id", ondelete="CASCADE")
    )
    group_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    due: Mapped[date | None] = mapped_column(Date)
    # Optional clock time on the due date. NULL means "sometime that day", which is why
    # this is a separate column rather than folding both into one timestamp.
    due_time: Mapped[time | None] = mapped_column(Time)
    priority: Mapped[str] = mapped_column(String(8), nullable=False, default="none")
    status: Mapped[str] = mapped_column(String(8), nullable=False, default="backlog")
    recurring: Mapped[str] = mapped_column(String(8), nullable=False, default="none")

    color_h: Mapped[int] = mapped_column(Integer, nullable=False, default=96)
    color_s: Mapped[int] = mapped_column(Integer, nullable=False, default=40)
    color_l: Mapped[int] = mapped_column(Integer, nullable=False, default=46)

    # ponytail: subtasks are a JSONB array, not a table — they are only ever read and
    # written together with their parent task. Split them out if they ever need querying.
    subtasks: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    list: Mapped[TaskList | None] = relationship(back_populates="tasks")

    __table_args__ = (Index("ix_tasks_user_due", "user_id", "due"),)
