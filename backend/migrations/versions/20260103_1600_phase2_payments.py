"""Add Phase 2 tables - payment gateway integration

Revision ID: 20260103_phase2
Revises: 20260103_phase1
Create Date: 2026-01-03

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260103_phase2'
down_revision = '20260103_phase1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ============== PAYMENT TABLES ==============
    
    # Payment Gateway Configurations
    op.create_table('payment_gateway_configs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('gateway', sa.Enum('RAZORPAY', 'STRIPE', 'PAYTM', 'PHONEPE', 'OFFLINE', name='paymentgateway'), nullable=False),
        sa.Column('display_name', sa.String(100), nullable=True),
        sa.Column('api_key', sa.String(500), nullable=True),
        sa.Column('api_secret', sa.String(500), nullable=True),
        sa.Column('config', postgresql.JSONB, server_default='{}'),
        sa.Column('webhook_url', sa.String(500), nullable=True),
        sa.Column('webhook_secret', sa.String(500), nullable=True),
        sa.Column('is_test_mode', sa.Boolean, server_default='true'),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('is_default', sa.Boolean, server_default='false'),
        sa.Column('supported_methods', postgresql.JSONB, server_default='["card", "upi", "netbanking", "wallet"]'),
        sa.Column('convenience_fee_percent', sa.Float, server_default='0'),
        sa.Column('convenience_fee_fixed', sa.Float, server_default='0'),
        sa.Column('pass_fee_to_customer', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=True),
        sa.UniqueConstraint('tenant_id', 'gateway', name='uq_payment_gateway_tenant'),
    )
    
    # Payment Orders
    op.create_table('payment_orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('order_number', sa.String(50), nullable=False, unique=True, index=True),
        sa.Column('gateway', sa.Enum('RAZORPAY', 'STRIPE', 'PAYTM', 'PHONEPE', 'OFFLINE', name='paymentgateway', create_type=False), nullable=False),
        sa.Column('gateway_order_id', sa.String(255), nullable=True, index=True),
        sa.Column('amount', sa.Float, nullable=False),
        sa.Column('currency', sa.String(3), server_default='INR'),
        sa.Column('convenience_fee', sa.Float, server_default='0'),
        sa.Column('total_amount', sa.Float, nullable=False),
        sa.Column('fee_payment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('fee_payments.id'), nullable=True, index=True),
        sa.Column('purpose', sa.String(100), server_default='fee_payment'),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('payer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id'), nullable=True, index=True),
        sa.Column('payer_name', sa.String(255), nullable=True),
        sa.Column('payer_email', sa.String(255), nullable=True),
        sa.Column('payer_phone', sa.String(20), nullable=True),
        sa.Column('status', sa.Enum('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED', 'EXPIRED', name='onlinepaymentstatus'), server_default='CREATED', index=True),
        sa.Column('gateway_response', postgresql.JSONB, server_default='{}'),
        sa.Column('expires_at', sa.DateTime, nullable=True),
        sa.Column('notes', postgresql.JSONB, server_default='{}'),
        sa.Column('receipt_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=True),
    )
    
    # Payment Transactions
    op.create_table('payment_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('payment_orders.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('transaction_id', sa.String(100), nullable=False, unique=True, index=True),
        sa.Column('gateway_transaction_id', sa.String(255), nullable=True, index=True),
        sa.Column('gateway_payment_id', sa.String(255), nullable=True),
        sa.Column('amount', sa.Float, nullable=False),
        sa.Column('currency', sa.String(3), server_default='INR'),
        sa.Column('payment_method', sa.String(50), nullable=True),
        sa.Column('payment_method_details', postgresql.JSONB, server_default='{}'),
        sa.Column('status', sa.Enum('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED', 'EXPIRED', name='onlinepaymentstatus', create_type=False), server_default='PENDING', index=True),
        sa.Column('gateway_response', postgresql.JSONB, server_default='{}'),
        sa.Column('error_code', sa.String(100), nullable=True),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('authorized_at', sa.DateTime, nullable=True),
        sa.Column('captured_at', sa.DateTime, nullable=True),
        sa.Column('failed_at', sa.DateTime, nullable=True),
        sa.Column('signature', sa.String(500), nullable=True),
        sa.Column('signature_verified', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=True),
    )
    
    # Payment Refunds
    op.create_table('payment_refunds',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('payment_transactions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('refund_id', sa.String(100), nullable=False, unique=True, index=True),
        sa.Column('gateway_refund_id', sa.String(255), nullable=True),
        sa.Column('amount', sa.Float, nullable=False),
        sa.Column('reason', sa.String(500), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', name='refundstatus'), server_default='PENDING'),
        sa.Column('gateway_response', postgresql.JSONB, server_default='{}'),
        sa.Column('processed_at', sa.DateTime, nullable=True),
        sa.Column('initiated_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('notes', postgresql.JSONB, server_default='{}'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=True),
    )
    
    # Payment Notifications (Webhook logs)
    op.create_table('payment_notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('gateway', sa.Enum('RAZORPAY', 'STRIPE', 'PAYTM', 'PHONEPE', 'OFFLINE', name='paymentgateway', create_type=False), nullable=False),
        sa.Column('event_type', sa.String(100), nullable=False),
        sa.Column('payload', postgresql.JSONB, nullable=False),
        sa.Column('headers', postgresql.JSONB, server_default='{}'),
        sa.Column('signature', sa.String(500), nullable=True),
        sa.Column('signature_valid', sa.Boolean, server_default='false'),
        sa.Column('processed', sa.Boolean, server_default='false'),
        sa.Column('processed_at', sa.DateTime, nullable=True),
        sa.Column('processing_error', sa.Text, nullable=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('payment_orders.id'), nullable=True),
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('payment_transactions.id'), nullable=True),
        sa.Column('received_at', sa.DateTime, server_default=sa.text('now()')),
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('payment_notifications')
    op.drop_table('payment_refunds')
    op.drop_table('payment_transactions')
    op.drop_table('payment_orders')
    op.drop_table('payment_gateway_configs')
    
    # Drop enums
    op.execute("DROP TYPE IF EXISTS refundstatus")
    op.execute("DROP TYPE IF EXISTS onlinepaymentstatus")
    op.execute("DROP TYPE IF EXISTS paymentgateway")
