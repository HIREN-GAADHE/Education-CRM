"""Create salary_structures, staff_salary_assignments, payslips tables

Revision ID: add_payroll_tables
Revises: add_health_and_diary_tables
Create Date: 2026-02-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'add_payroll_tables'
down_revision: Union[str, None] = 'add_health_and_diary_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── salary_structures ──────────────────────────────────────────────────
    op.create_table(
        'salary_structures',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('base_salary', sa.Numeric(12, 2), nullable=False),
        sa.Column('allowances', postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('deductions', postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.text('true')),
        sa.Column('is_deleted', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('deleted_at', sa.DateTime, nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_salary_structures_tenant_id', 'salary_structures', ['tenant_id'])

    # ── staff_salary_assignments ───────────────────────────────────────────
    op.create_table(
        'staff_salary_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('staff_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('staff.id', ondelete='CASCADE'), nullable=False),
        sa.Column('structure_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('salary_structures.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('effective_from', sa.Date, nullable=False),
        sa.Column('effective_to', sa.Date, nullable=True),
        sa.Column('custom_base_salary', sa.Numeric(12, 2), nullable=True),
        sa.Column('bank_account_number', sa.String(50), nullable=True),
        sa.Column('bank_name', sa.String(100), nullable=True),
        sa.Column('ifsc_code', sa.String(20), nullable=True),
        sa.Column('pan_number', sa.String(20), nullable=True),
        sa.Column('is_deleted', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('deleted_at', sa.DateTime, nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_staff_salary_assignments_staff_id', 'staff_salary_assignments', ['staff_id'])
    op.create_index('ix_staff_salary_assignments_tenant_id', 'staff_salary_assignments', ['tenant_id'])

    # ── payslips ───────────────────────────────────────────────────────────
    op.create_table(
        'payslips',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('staff_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('staff.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assignment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('staff_salary_assignments.id', ondelete='SET NULL'), nullable=True),
        sa.Column('month', sa.Integer, nullable=False),
        sa.Column('year', sa.Integer, nullable=False),
        sa.Column('base_salary', sa.Numeric(12, 2), nullable=False),
        sa.Column('gross_salary', sa.Numeric(12, 2), nullable=False),
        sa.Column('total_deductions', sa.Numeric(12, 2), nullable=False, server_default=sa.text('0')),
        sa.Column('net_salary', sa.Numeric(12, 2), nullable=False),
        sa.Column('allowances_breakdown', postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('deductions_breakdown', postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('days_worked', sa.Integer, nullable=True),
        sa.Column('loss_of_pay_days', sa.Integer, server_default=sa.text('0')),
        sa.Column('loss_of_pay_amount', sa.Numeric(12, 2), server_default=sa.text('0')),
        sa.Column('bonus', sa.Numeric(12, 2), server_default=sa.text('0')),
        sa.Column('advance_deduction', sa.Numeric(12, 2), server_default=sa.text('0')),
        sa.Column('status', sa.String(20), nullable=False, server_default=sa.text("'pending'")),
        sa.Column('payment_mode', sa.String(30), nullable=True),
        sa.Column('paid_at', sa.DateTime, nullable=True),
        sa.Column('paid_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('remarks', sa.Text, nullable=True),
        sa.Column('is_deleted', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('deleted_at', sa.DateTime, nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_payslips_staff_id', 'payslips', ['staff_id'])
    op.create_index('ix_payslips_tenant_id', 'payslips', ['tenant_id'])
    op.create_index('ix_payslips_status', 'payslips', ['status'])
    op.create_index('ix_payslips_month_year', 'payslips', ['month', 'year'])


def downgrade() -> None:
    op.drop_table('payslips')
    op.drop_table('staff_salary_assignments')
    op.drop_table('salary_structures')
