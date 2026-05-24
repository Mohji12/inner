"""add_auth_hardening_fields

Revision ID: 0522fa347498
Revises: 2c0d55480660
Create Date: 2026-04-19 17:05:21.526851

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = '0522fa347498'
down_revision: Union[str, None] = '2c0d55480660'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Adding columns to mentors
    op.add_column('mentors', sa.Column('totp_secret', sa.String(length=32), nullable=True))
    op.add_column('mentors', sa.Column('is_totp_enabled', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    op.add_column('mentors', sa.Column('google_id', sa.String(length=255), nullable=True))
    op.create_index(op.f('ix_mentors_google_id'), 'mentors', ['google_id'], unique=False)

    # Adding columns to users
    op.add_column('users', sa.Column('totp_secret', sa.String(length=32), nullable=True))
    op.add_column('users', sa.Column('is_totp_enabled', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    op.add_column('users', sa.Column('google_id', sa.String(length=255), nullable=True))
    op.create_index(op.f('ix_users_google_id'), 'users', ['google_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_google_id'), table_name='users')
    op.drop_column('users', 'google_id')
    op.drop_column('users', 'is_totp_enabled')
    op.drop_column('users', 'totp_secret')
    op.alter_column('refresh_tokens', 'role',
               existing_type=mysql.VARCHAR(collation='utf8mb4_unicode_ci', length=16),
               comment='user or mentor',
               existing_nullable=False)
    op.drop_index(op.f('ix_payments_user_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_booking_id'), table_name='payments')
    op.create_index('idx_payments_booking', 'payments', ['booking_id'], unique=False)
    op.drop_index(op.f('ix_mentors_phone_number'), table_name='mentors')
    op.drop_index(op.f('ix_mentors_google_id'), table_name='mentors')
    op.drop_index(op.f('ix_mentors_email'), table_name='mentors')
    op.create_index('uk_mentors_phone', 'mentors', ['phone_number'], unique=False)
    op.create_index('uk_mentors_email', 'mentors', ['email'], unique=False)
    op.create_index('idx_mentors_status_approved', 'mentors', ['status', 'is_approved'], unique=False)
    op.create_index('idx_mentors_email_verified', 'mentors', ['email_verified'], unique=False)
    op.alter_column('mentors', 'chat_price_per_minute',
               existing_type=mysql.DECIMAL(precision=10, scale=2),
               comment='0 disables chat',
               existing_nullable=False,
               existing_server_default=sa.text("'0.00'"))
    op.drop_column('mentors', 'google_id')
    op.drop_column('mentors', 'is_totp_enabled')
    op.drop_column('mentors', 'totp_secret')
    op.drop_index(op.f('ix_email_otp_codes_email'), table_name='email_otp_codes')
    op.create_index('idx_otp_role_email', 'email_otp_codes', ['role', 'email'], unique=False)
    op.create_index('idx_otp_expires', 'email_otp_codes', ['expires_at'], unique=False)
    op.alter_column('email_otp_codes', 'role',
               existing_type=mysql.VARCHAR(collation='utf8mb4_unicode_ci', length=16),
               comment='user or mentor',
               existing_nullable=False)
    op.drop_index(op.f('ix_chat_sessions_user_id'), table_name='chat_sessions')
    op.drop_index(op.f('ix_chat_sessions_mentor_id'), table_name='chat_sessions')
    op.create_index('idx_chat_sessions_user', 'chat_sessions', ['user_id'], unique=False)
    op.create_index('idx_chat_sessions_mentor_status_ends', 'chat_sessions', ['mentor_id', 'status', 'ends_at'], unique=False)
    op.alter_column('chat_sessions', 'status',
               existing_type=mysql.VARCHAR(collation='utf8mb4_unicode_ci', length=32),
               comment='active paused ended',
               existing_nullable=False)
    op.drop_index(op.f('ix_chat_purchases_user_id'), table_name='chat_purchases')
    op.drop_index(op.f('ix_chat_purchases_session_id'), table_name='chat_purchases')
    op.create_index('idx_chat_purchases_user', 'chat_purchases', ['user_id'], unique=False)
    op.create_index('idx_chat_purchases_session', 'chat_purchases', ['session_id'], unique=False)
    op.drop_index(op.f('ix_chat_messages_session_id'), table_name='chat_messages')
    op.create_index('idx_chat_messages_session_created', 'chat_messages', ['session_id', 'created_at'], unique=False)
    op.alter_column('chat_messages', 'sender_role',
               existing_type=mysql.VARCHAR(collation='utf8mb4_unicode_ci', length=16),
               comment='user or mentor',
               existing_nullable=False)
    op.drop_index(op.f('ix_bookings_user_id'), table_name='bookings')
    op.drop_index(op.f('ix_bookings_mentor_id'), table_name='bookings')
    op.create_index('idx_bookings_user', 'bookings', ['user_id'], unique=False)
    op.create_index('idx_bookings_status', 'bookings', ['status'], unique=False)
    op.create_index('idx_bookings_mentor', 'bookings', ['mentor_id'], unique=False)
    op.drop_index(op.f('ix_availability_slots_mentor_id'), table_name='availability_slots')
    op.create_index('idx_slots_mentor_date_booked', 'availability_slots', ['mentor_id', 'slot_date', 'is_booked'], unique=False)
    op.alter_column('availability_slots', 'slot_duration',
               existing_type=mysql.INTEGER(),
               comment='minutes',
               existing_nullable=False)
    op.alter_column('admins', 'id',
               existing_type=sa.CHAR(length=36),
               type_=mysql.VARCHAR(collation='utf8mb4_unicode_ci', length=36),
               existing_nullable=False)
    # ### end Alembic commands ###
