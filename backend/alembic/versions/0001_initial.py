"""initial schema: task_lists and tasks

Revision ID: 0001
Revises:
Create Date: 2026-09-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "task_lists",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("hue", sa.Integer(), nullable=False, server_default="96"),
        sa.Column(
            "groups",
            postgresql.ARRAY(sa.String(length=120)),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("position", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_task_lists_user_id", "task_lists", ["user_id"])

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("list_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("group_name", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("done", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("due", sa.Date(), nullable=True),
        sa.Column("priority", sa.String(length=8), nullable=False, server_default="none"),
        sa.Column("status", sa.String(length=8), nullable=False, server_default="backlog"),
        sa.Column("recurring", sa.String(length=8), nullable=False, server_default="none"),
        sa.Column("color_h", sa.Integer(), nullable=False, server_default="96"),
        sa.Column("color_s", sa.Integer(), nullable=False, server_default="40"),
        sa.Column("color_l", sa.Integer(), nullable=False, server_default="46"),
        sa.Column("subtasks", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("position", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["list_id"], ["task_lists.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        # Enum-ish columns are validated by Pydantic at the edge; the CHECKs stop anything
        # that reaches the database another way.
        sa.CheckConstraint("priority IN ('none','low','med','high')", name="ck_tasks_priority"),
        sa.CheckConstraint("status IN ('backlog','next','doing','done')", name="ck_tasks_status"),
        sa.CheckConstraint(
            "recurring IN ('none','daily','weekly','monthly')", name="ck_tasks_recurring"
        ),
    )
    op.create_index("ix_tasks_user_position", "tasks", ["user_id", "position"])


def downgrade() -> None:
    op.drop_index("ix_tasks_user_position", table_name="tasks")
    op.drop_table("tasks")
    op.drop_index("ix_task_lists_user_id", table_name="task_lists")
    op.drop_table("task_lists")
