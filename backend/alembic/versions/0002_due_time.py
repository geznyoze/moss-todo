"""optional clock time on due dates; tasks sort by due, not by hand

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("due_time", sa.Time(), nullable=True))

    # Tasks now list by due date then creation time, so the manual fractional index
    # no longer affects any ordering.
    op.drop_index("ix_tasks_user_position", table_name="tasks")
    op.drop_column("tasks", "position")
    op.create_index("ix_tasks_user_due", "tasks", ["user_id", "due"])


def downgrade() -> None:
    op.drop_index("ix_tasks_user_due", table_name="tasks")
    op.add_column(
        "tasks", sa.Column("position", sa.Float(), nullable=False, server_default="0")
    )
    op.create_index("ix_tasks_user_position", "tasks", ["user_id", "position"])
    op.drop_column("tasks", "due_time")
