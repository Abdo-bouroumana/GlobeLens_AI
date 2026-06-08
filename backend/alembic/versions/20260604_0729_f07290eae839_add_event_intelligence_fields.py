"""add_event_intelligence_fields

Revision ID: f07290eae839
Revises: 0001_initial_schema
Create Date: 2026-06-04 07:29:43.066041+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f07290eae839'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add bias_lean Enum column and status String column with DRAFT default
    op.add_column('events', sa.Column('bias_lean', sa.Enum('LEFT', 'CENTER_LEFT', 'CENTER', 'CENTER_RIGHT', 'RIGHT', name='biaslean'), nullable=True))
    op.add_column('events', sa.Column('status', sa.String(length=50), nullable=False, server_default='DRAFT'))
    op.create_index(op.f('ix_events_status'), 'events', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_events_status'), table_name='events')
    op.drop_column('events', 'status')
    op.drop_column('events', 'bias_lean')
