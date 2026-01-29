"""Add Phase 3 (parent student) and Phase 4 (library) tables

Revision ID: 20260104_1100_phase3_phase4
Revises: 20260103_1600_phase2_payments
Create Date: 2026-01-04 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260104_1100_phase3_phase4'
down_revision = '20260103_phase2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add user_id to students table for student self-service portal
    op.add_column('students', sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_students_user_id', 'students', 'users', ['user_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_students_user_id', 'students', ['user_id'])
    
    # Create parent_students table
    op.create_table('parent_students',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('parent_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('relationship_type', sa.String(50), nullable=False, server_default='guardian'),
        sa.Column('is_primary_contact', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('can_receive_notifications', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('can_receive_sms', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('can_receive_email', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('can_view_attendance', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('can_view_grades', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('can_view_fees', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('can_pay_fees', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('can_view_timetable', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('can_download_certificates', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'parent_user_id', 'student_id', name='uq_parent_student_link')
    )
    op.create_index('ix_parent_students_parent_user_id', 'parent_students', ['parent_user_id'])
    op.create_index('ix_parent_students_student_id', 'parent_students', ['student_id'])
    
    # Create library_books table
    op.create_table('library_books',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('isbn', sa.String(20), nullable=True),
        sa.Column('isbn13', sa.String(17), nullable=True),
        sa.Column('accession_number', sa.String(50), nullable=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('subtitle', sa.String(500), nullable=True),
        sa.Column('author', sa.String(300), nullable=False),
        sa.Column('co_authors', postgresql.JSONB(), server_default='[]'),
        sa.Column('publisher', sa.String(200), nullable=True),
        sa.Column('publication_year', sa.Integer(), nullable=True),
        sa.Column('edition', sa.String(50), nullable=True),
        sa.Column('language', sa.String(50), server_default='English'),
        sa.Column('category', sa.String(50), server_default='other'),
        sa.Column('subject', sa.String(200), nullable=True),
        sa.Column('keywords', postgresql.JSONB(), server_default='[]'),
        sa.Column('pages', sa.Integer(), nullable=True),
        sa.Column('binding', sa.String(50), nullable=True),
        sa.Column('rack_number', sa.String(50), nullable=True),
        sa.Column('shelf_number', sa.String(50), nullable=True),
        sa.Column('price', sa.Float(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cover_image_url', sa.String(500), nullable=True),
        sa.Column('total_copies', sa.Integer(), server_default='1'),
        sa.Column('available_copies', sa.Integer(), server_default='1'),
        sa.Column('extra_data', postgresql.JSONB(), server_default='{}'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_library_books_title', 'library_books', ['title'])
    op.create_index('ix_library_books_author', 'library_books', ['author'])
    op.create_index('ix_library_books_isbn', 'library_books', ['isbn'])
    
    # Create library_book_copies table
    op.create_table('library_book_copies',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('book_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('barcode', sa.String(50), nullable=False),
        sa.Column('copy_number', sa.Integer(), server_default='1'),
        sa.Column('condition', sa.String(50), server_default='good'),
        sa.Column('is_available', sa.Boolean(), server_default='true'),
        sa.Column('is_reference_only', sa.Boolean(), server_default='false'),
        sa.Column('rack_number', sa.String(50), nullable=True),
        sa.Column('shelf_number', sa.String(50), nullable=True),
        sa.Column('acquisition_date', sa.Date(), nullable=True),
        sa.Column('acquisition_source', sa.String(200), nullable=True),
        sa.Column('acquisition_price', sa.Float(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['book_id'], ['library_books.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'barcode', name='uq_book_copy_barcode')
    )
    op.create_index('ix_library_book_copies_barcode', 'library_book_copies', ['barcode'])
    
    # Create library_members table
    op.create_table('library_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('member_code', sa.String(50), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('staff_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('member_type', sa.String(50), server_default='student'),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('membership_start', sa.Date(), nullable=True),
        sa.Column('membership_end', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('max_books', sa.Integer(), server_default='3'),
        sa.Column('max_days', sa.Integer(), server_default='14'),
        sa.Column('total_fines', sa.Float(), server_default='0'),
        sa.Column('fines_paid', sa.Float(), server_default='0'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['staff_id'], ['staff.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'member_code', name='uq_library_member_code')
    )
    op.create_index('ix_library_members_member_code', 'library_members', ['member_code'])
    
    # Create library_book_issues table
    op.create_table('library_book_issues',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('book_copy_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('member_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('issue_date', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('return_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(50), server_default='issued'),
        sa.Column('renewal_count', sa.Integer(), server_default='0'),
        sa.Column('max_renewals', sa.Integer(), server_default='2'),
        sa.Column('fine_amount', sa.Float(), server_default='0'),
        sa.Column('fine_paid', sa.Boolean(), server_default='false'),
        sa.Column('fine_per_day', sa.Float(), server_default='5.0'),
        sa.Column('issued_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('returned_to_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('condition_at_issue', sa.String(50), nullable=True),
        sa.Column('condition_at_return', sa.String(50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['book_copy_id'], ['library_book_copies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['member_id'], ['library_members.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['issued_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['returned_to_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create library_settings table
    op.create_table('library_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('default_issue_days', sa.Integer(), server_default='14'),
        sa.Column('max_renewals', sa.Integer(), server_default='2'),
        sa.Column('fine_per_day', sa.Float(), server_default='5.0'),
        sa.Column('fine_on_sunday', sa.Boolean(), server_default='false'),
        sa.Column('fine_on_holidays', sa.Boolean(), server_default='false'),
        sa.Column('max_fine_per_book', sa.Float(), nullable=True),
        sa.Column('student_max_books', sa.Integer(), server_default='3'),
        sa.Column('staff_max_books', sa.Integer(), server_default='5'),
        sa.Column('faculty_max_books', sa.Integer(), server_default='10'),
        sa.Column('send_due_reminders', sa.Boolean(), server_default='true'),
        sa.Column('reminder_days_before', sa.Integer(), server_default='2'),
        sa.Column('send_overdue_alerts', sa.Boolean(), server_default='true'),
        sa.Column('working_hours', postgresql.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('library_settings')
    op.drop_table('library_book_issues')
    op.drop_table('library_members')
    op.drop_table('library_book_copies')
    op.drop_table('library_books')
    op.drop_table('parent_students')
    op.drop_index('ix_students_user_id', 'students')
    op.drop_constraint('fk_students_user_id', 'students', type_='foreignkey')
    op.drop_column('students', 'user_id')
