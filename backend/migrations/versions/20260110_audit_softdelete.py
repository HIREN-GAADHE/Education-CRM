"""Add audit_logs table and attendance soft delete fields

Revision ID: 20260110_audit_softdelete
Revises: 
Create Date: 2026-01-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260110_audit_softdelete'
down_revision = '20260104_1100_phase3_phase4'
branch_labels = None
depends_on = None


def upgrade():
    # Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id'), nullable=True, index=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True, index=True),
        sa.Column('user_email', sa.String(255), nullable=True),
        sa.Column('action', sa.Enum('create', 'read', 'update', 'delete', 'login', 'logout', 
                                     'failed_login', 'password_change', 'permission_change', 
                                     'export', 'import', name='auditaction'), nullable=False, index=True),
        sa.Column('resource_type', sa.String(100), nullable=False, index=True),
        sa.Column('resource_id', postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column('resource_name', sa.String(255), nullable=True),
        sa.Column('old_value', postgresql.JSONB, nullable=True),
        sa.Column('new_value', postgresql.JSONB, nullable=True),
        sa.Column('changes', postgresql.JSONB, nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('request_id', sa.String(50), nullable=True),
        sa.Column('extra_data', postgresql.JSONB, default={}),
        sa.Column('timestamp', sa.DateTime, nullable=False, index=True),
        sa.Column('created_at', sa.DateTime, nullable=True),
        sa.Column('updated_at', sa.DateTime, nullable=True),
    )
    
    # Add soft delete fields to attendance table if not exists
    # These columns come from SoftDeleteMixin
    op.add_column('attendance', 
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False)
    )
    op.add_column('attendance',
        sa.Column('deleted_at', sa.DateTime(), nullable=True)
    )
    op.add_column('attendance',
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True)
    )
    
    # Create index for soft delete queries
    op.create_index('ix_attendance_is_deleted', 'attendance', ['is_deleted'])


def downgrade():
    # Drop index
    op.drop_index('ix_attendance_is_deleted', table_name='attendance')
    
    # Remove soft delete columns from attendance
    op.drop_column('attendance', 'deleted_by')
    op.drop_column('attendance', 'deleted_at')
    op.drop_column('attendance', 'is_deleted')
    
    # Drop audit_logs table
    op.drop_table('audit_logs')
    
    # Drop enum type
    op.execute('DROP TYPE IF EXISTS auditaction')
