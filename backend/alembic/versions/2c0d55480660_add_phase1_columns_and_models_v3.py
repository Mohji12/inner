"""Add phase1 columns and models clean

Revision ID: 2c0d55480660
Revises: 
Create Date: 2026-04-19 15:33:31.387738

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '2c0d55480660'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Create new tables with proper MySQL options
    op.create_table('password_reset_tokens',
    sa.Column('id', sa.CHAR(length=36), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('role', sa.String(length=16), nullable=False),
    sa.Column('token_hash', sa.String(length=255), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('used', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    mysql_engine='InnoDB',
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci'
    )
    op.create_index(op.f('ix_password_reset_tokens_email'), 'password_reset_tokens', ['email'], unique=False)

    op.create_table('notifications',
    sa.Column('id', sa.CHAR(length=36), nullable=False),
    sa.Column('user_id', sa.CHAR(length=36), nullable=True),
    sa.Column('mentor_id', sa.CHAR(length=36), nullable=True),
    sa.Column('type', sa.String(length=64), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('link', sa.String(length=512), nullable=True),
    sa.Column('is_read', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['mentor_id'], ['mentors.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    mysql_engine='InnoDB',
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci'
    )
    op.create_index(op.f('ix_notifications_mentor_id'), 'notifications', ['mentor_id'], unique=False)
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)

    # 2. Add columns to chat_messages
    op.add_column('chat_messages', sa.Column('read_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('chat_messages', sa.Column('reply_to_message_id', sa.CHAR(length=36), nullable=True))
    op.add_column('chat_messages', sa.Column('attachment_url', sa.String(length=512), nullable=True))
    op.add_column('chat_messages', sa.Column('attachment_type', sa.String(length=32), nullable=True))
    op.add_column('chat_messages', sa.Column('attachment_filename', sa.String(length=255), nullable=True))
    op.add_column('chat_messages', sa.Column('attachment_size_bytes', sa.Integer(), nullable=True))
    op.add_column('chat_messages', sa.Column('edited_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('chat_messages', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    op.add_column('chat_messages', sa.Column('is_pinned', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    op.add_column('chat_messages', sa.Column('pinned_at', sa.DateTime(timezone=True), nullable=True))

    # 3. Add columns to chat_sessions
    op.add_column('chat_sessions', sa.Column('last_message_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('chat_sessions', sa.Column('unread_count_user', sa.Integer(), nullable=False, server_default=sa.text('0')))
    op.add_column('chat_sessions', sa.Column('unread_count_mentor', sa.Integer(), nullable=False, server_default=sa.text('0')))

    # 4. Add columns to mentors
    op.add_column('mentors', sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('mentors', sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default=sa.text('0')))
    op.add_column('mentors', sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))
    op.add_column('mentors', sa.Column('deactivated_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('mentors', sa.Column('avatar_url', sa.String(length=512), nullable=True))
    op.add_column('mentors', sa.Column('theme_preference', sa.String(length=16), nullable=False, server_default=sa.text("'system'")))

    # 5. Add columns to users
    op.add_column('users', sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default=sa.text('0')))
    op.add_column('users', sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('deactivated_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('avatar_url', sa.String(length=512), nullable=True))
    op.add_column('users', sa.Column('theme_preference', sa.String(length=16), nullable=False, server_default=sa.text("'system'")))

def downgrade() -> None:
    op.drop_column('users', 'theme_preference')
    op.drop_column('users', 'avatar_url')
    op.drop_column('users', 'deactivated_at')
    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'failed_login_attempts')
    op.drop_column('users', 'last_seen_at')
    op.drop_column('mentors', 'theme_preference')
    op.drop_column('mentors', 'avatar_url')
    op.drop_column('mentors', 'deactivated_at')
    op.drop_column('mentors', 'locked_until')
    op.drop_column('mentors', 'failed_login_attempts')
    op.drop_column('mentors', 'last_seen_at')
    op.drop_column('chat_sessions', 'unread_count_mentor')
    op.drop_column('chat_sessions', 'unread_count_user')
    op.drop_column('chat_sessions', 'last_message_at')
    op.drop_column('chat_messages', 'pinned_at')
    op.drop_column('chat_messages', 'is_pinned')
    op.drop_column('chat_messages', 'is_deleted')
    op.drop_column('chat_messages', 'edited_at')
    op.drop_column('chat_messages', 'attachment_size_bytes')
    op.drop_column('chat_messages', 'attachment_filename')
    op.drop_column('chat_messages', 'attachment_type')
    op.drop_column('chat_messages', 'attachment_url')
    op.drop_column('chat_messages', 'reply_to_message_id')
    op.drop_column('chat_messages', 'read_at')
    op.drop_table('notifications')
    op.drop_table('password_reset_tokens')
