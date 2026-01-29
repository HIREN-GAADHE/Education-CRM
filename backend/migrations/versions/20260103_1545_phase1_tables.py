"""Add Phase 1 tables - notifications, certificates, timetable, examinations

Revision ID: 20260103_phase1
Revises: 8899d25e1281
Create Date: 2026-01-03

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260103_phase1'
down_revision = '8899d25e1281'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ============== NOTIFICATION TABLES ==============
    
    # Notification Templates
    op.create_table('notification_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('code', sa.String(100), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('template_type', sa.Enum('EMAIL', 'SMS', 'PUSH', 'WHATSAPP', 'IN_APP', name='notificationtype'), nullable=False),
        sa.Column('subject', sa.String(500), nullable=True),
        sa.Column('body', sa.Text, nullable=False),
        sa.Column('html_body', sa.Text, nullable=True),
        sa.Column('variables', postgresql.JSONB, server_default='[]'),
        sa.Column('sample_data', postgresql.JSONB, server_default='{}'),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=True),
        sa.UniqueConstraint('tenant_id', 'code', name='uq_notification_template_tenant_code'),
    )
    
    # Notifications
    op.create_table('notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('template_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('notification_templates.id'), nullable=True),
        sa.Column('notification_type', sa.Enum('EMAIL', 'SMS', 'PUSH', 'WHATSAPP', 'IN_APP', name='notificationtype', create_type=False), nullable=False),
        sa.Column('recipient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('recipient_email', sa.String(255), nullable=True),
        sa.Column('recipient_phone', sa.String(20), nullable=True),
        sa.Column('subject', sa.String(500), nullable=True),
        sa.Column('body', sa.Text, nullable=False),
        sa.Column('html_body', sa.Text, nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'QUEUED', 'SENT', 'FAILED', 'DELIVERED', 'BOUNCED', name='notificationstatus'), server_default='PENDING'),
        sa.Column('priority', sa.Enum('LOW', 'NORMAL', 'HIGH', 'URGENT', name='notificationpriority'), server_default='NORMAL'),
        sa.Column('scheduled_at', sa.DateTime, nullable=True),
        sa.Column('sent_at', sa.DateTime, nullable=True),
        sa.Column('delivered_at', sa.DateTime, nullable=True),
        sa.Column('failure_reason', sa.Text, nullable=True),
        sa.Column('retry_count', sa.Integer, server_default='0'),
        sa.Column('provider_message_id', sa.String(255), nullable=True),
        sa.Column('provider_response', postgresql.JSONB, nullable=True),
        sa.Column('metadata', postgresql.JSONB, server_default='{}'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=True),
    )
    op.create_index('ix_notifications_status', 'notifications', ['status'])
    op.create_index('ix_notifications_type', 'notifications', ['notification_type'])
    
    # Notification Preferences
    op.create_table('notification_preferences',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email_enabled', sa.Boolean, server_default='true'),
        sa.Column('sms_enabled', sa.Boolean, server_default='true'),
        sa.Column('push_enabled', sa.Boolean, server_default='true'),
        sa.Column('whatsapp_enabled', sa.Boolean, server_default='false'),
        sa.Column('in_app_enabled', sa.Boolean, server_default='true'),
        sa.Column('quiet_hours_start', sa.Time, nullable=True),
        sa.Column('quiet_hours_end', sa.Time, nullable=True),
        sa.Column('disabled_categories', postgresql.JSONB, server_default='[]'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=True),
        sa.UniqueConstraint('tenant_id', 'user_id', name='uq_notification_pref_tenant_user'),
    )
    
    # ============== CERTIFICATE TABLES ==============
    
    # Certificate Templates
    op.create_table('certificate_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('code', sa.String(100), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('certificate_type', sa.Enum('BONAFIDE', 'TRANSFER', 'CHARACTER', 'COURSE_COMPLETION', 'MERIT', 'PARTICIPATION', 'ACHIEVEMENT', 'CONDUCT', 'STUDY', 'CUSTOM', name='certificatetype'), nullable=False),
        sa.Column('html_template', sa.Text, nullable=False),
        sa.Column('css_styles', sa.Text, nullable=True),
        sa.Column('page_size', sa.String(20), server_default='A4'),
        sa.Column('orientation', sa.String(20), server_default='landscape'),
        sa.Column('margins', postgresql.JSONB, server_default='{"top": 20, "right": 20, "bottom": 20, "left": 20}'),
        sa.Column('header_html', sa.Text, nullable=True),
        sa.Column('footer_html', sa.Text, nullable=True),
        sa.Column('background_image_url', sa.String(500), nullable=True),
        sa.Column('watermark_text', sa.String(100), nullable=True),
        sa.Column('signature_positions', postgresql.JSONB, server_default='[]'),
        sa.Column('variables', postgresql.JSONB, server_default='[]'),
        sa.Column('sample_data', postgresql.JSONB, server_default='{}'),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('is_default', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=True),
        sa.UniqueConstraint('tenant_id', 'code', name='uq_certificate_template_tenant_code'),
    )
    
    # Certificates
    op.create_table('certificates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('certificate_number', sa.String(50), nullable=False, index=True),
        sa.Column('verification_code', sa.String(50), unique=True, nullable=False, index=True),
        sa.Column('template_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('certificate_templates.id'), nullable=True),
        sa.Column('certificate_type', sa.Enum('BONAFIDE', 'TRANSFER', 'CHARACTER', 'COURSE_COMPLETION', 'MERIT', 'PARTICIPATION', 'ACHIEVEMENT', 'CONDUCT', 'STUDY', 'CUSTOM', name='certificatetype', create_type=False), nullable=False),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id'), nullable=False, index=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('certificate_data', postgresql.JSONB, server_default='{}'),
        sa.Column('rendered_html', sa.Text, nullable=True),
        sa.Column('pdf_url', sa.String(500), nullable=True),
        sa.Column('pdf_generated_at', sa.DateTime, nullable=True),
        sa.Column('status', sa.Enum('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED', 'REVOKED', 'EXPIRED', name='certificatestatus'), server_default='DRAFT'),
        sa.Column('requested_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime, nullable=True),
        sa.Column('issued_at', sa.DateTime, nullable=True),
        sa.Column('issued_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('valid_from', sa.DateTime, nullable=True),
        sa.Column('valid_until', sa.DateTime, nullable=True),
        sa.Column('revoked_at', sa.DateTime, nullable=True),
        sa.Column('revoked_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('revocation_reason', sa.Text, nullable=True),
        sa.Column('download_count', sa.Integer, server_default='0'),
        sa.Column('last_downloaded_at', sa.DateTime, nullable=True),
        sa.Column('verification_count', sa.Integer, server_default='0'),
        sa.Column('last_verified_at', sa.DateTime, nullable=True),
        sa.Column('metadata', postgresql.JSONB, server_default='{}'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=True),
        sa.UniqueConstraint('tenant_id', 'certificate_number', name='uq_certificate_tenant_number'),
    )
    
    # ============== TIMETABLE TABLES ==============
    
    # Time Slots
    op.create_table('time_slots',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('code', sa.String(50), nullable=True),
        sa.Column('start_time', sa.Time, nullable=False),
        sa.Column('end_time', sa.Time, nullable=False),
        sa.Column('duration_minutes', sa.Integer, nullable=True),
        sa.Column('slot_type', sa.Enum('CLASS', 'BREAK', 'LUNCH', 'ASSEMBLY', 'FREE', 'EXAM', name='timeslottype'), server_default='CLASS'),
        sa.Column('order', sa.Integer, server_default='0'),
        sa.Column('applicable_days', postgresql.JSONB, server_default='[1, 2, 3, 4, 5]'),
        sa.Column('academic_year', sa.String(20), nullable=True),
        sa.Column('term', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=True),
        sa.CheckConstraint('end_time > start_time', name='ck_time_slot_valid_time'),
        sa.UniqueConstraint('tenant_id', 'name', 'academic_year', name='uq_time_slot_tenant_name_year'),
    )
    
    # Rooms
    op.create_table('rooms',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('code', sa.String(50), nullable=True),
        sa.Column('building', sa.String(100), nullable=True),
        sa.Column('floor', sa.String(20), nullable=True),
        sa.Column('capacity', sa.Integer, nullable=True),
        sa.Column('room_type', sa.String(50), server_default='classroom'),
        sa.Column('facilities', postgresql.JSONB, server_default='[]'),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=True),
        sa.UniqueConstraint('tenant_id', 'name', name='uq_room_tenant_name'),
    )
    
    # Timetable Entries
    op.create_table('timetable_entries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('time_slot_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('time_slots.id'), nullable=False, index=True),
        sa.Column('day_of_week', sa.Enum('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY', name='dayofweek'), nullable=False),
        sa.Column('course_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('courses.id'), nullable=True),
        sa.Column('subject_name', sa.String(200), nullable=True),
        sa.Column('teacher_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('staff.id'), nullable=True),
        sa.Column('room_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('rooms.id'), nullable=True),
        sa.Column('class_name', sa.String(100), nullable=True, index=True),
        sa.Column('section', sa.String(50), nullable=True),
        sa.Column('academic_year', sa.String(20), nullable=True),
        sa.Column('term', sa.String(50), nullable=True),
        sa.Column('effective_from', sa.DateTime, nullable=True),
        sa.Column('effective_until', sa.DateTime, nullable=True),
        sa.Column('status', sa.Enum('DRAFT', 'ACTIVE', 'ARCHIVED', name='timetablestatus'), server_default='ACTIVE'),
        sa.Column('notes', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=True),
        sa.UniqueConstraint('tenant_id', 'time_slot_id', 'day_of_week', 'teacher_id', 'academic_year', name='uq_timetable_teacher_slot'),
        sa.UniqueConstraint('tenant_id', 'time_slot_id', 'day_of_week', 'room_id', 'academic_year', name='uq_timetable_room_slot'),
        sa.UniqueConstraint('tenant_id', 'time_slot_id', 'day_of_week', 'class_name', 'section', 'academic_year', name='uq_timetable_class_slot'),
    )
    
    # Timetable Conflicts
    op.create_table('timetable_conflicts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('entry_1_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('timetable_entries.id'), nullable=False),
        sa.Column('entry_2_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('timetable_entries.id'), nullable=False),
        sa.Column('conflict_type', sa.String(50), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('resolved', sa.Boolean, server_default='false'),
        sa.Column('resolved_at', sa.DateTime, nullable=True),
        sa.Column('resolved_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('resolution_notes', sa.String(500), nullable=True),
        sa.Column('detected_at', sa.DateTime, server_default=sa.text('now()')),
    )
    
    # ============== EXAMINATION TABLES ==============
    
    # Grade Scales
    op.create_table('grade_scales',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('code', sa.String(50), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('scale_type', sa.String(50), server_default='percentage'),
        sa.Column('academic_year', sa.String(20), nullable=True),
        sa.Column('is_default', sa.Boolean, server_default='false'),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=True),
        sa.UniqueConstraint('tenant_id', 'code', name='uq_grade_scale_tenant_code'),
    )
    
    # Grade Levels
    op.create_table('grade_levels',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('scale_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('grade_scales.id', ondelete='CASCADE'), nullable=False),
        sa.Column('grade', sa.String(10), nullable=False),
        sa.Column('grade_point', sa.Float, nullable=True),
        sa.Column('min_value', sa.Float, nullable=False),
        sa.Column('max_value', sa.Float, nullable=False),
        sa.Column('description', sa.String(100), nullable=True),
        sa.Column('color', sa.String(7), nullable=True),
        sa.Column('order', sa.Integer, server_default='0'),
    )
    
    # Examinations
    op.create_table('examinations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('code', sa.String(50), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('exam_type', sa.Enum('UNIT_TEST', 'MIDTERM', 'FINAL', 'QUIZ', 'ASSIGNMENT', 'PROJECT', 'PRACTICAL', 'ORAL', 'INTERNAL', name='examtype'), nullable=False),
        sa.Column('course_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('courses.id'), nullable=True),
        sa.Column('subject_name', sa.String(200), nullable=True),
        sa.Column('class_name', sa.String(100), nullable=True, index=True),
        sa.Column('section', sa.String(50), nullable=True),
        sa.Column('academic_year', sa.String(20), nullable=True, index=True),
        sa.Column('term', sa.String(50), nullable=True),
        sa.Column('exam_date', sa.DateTime, nullable=True),
        sa.Column('start_time', sa.DateTime, nullable=True),
        sa.Column('end_time', sa.DateTime, nullable=True),
        sa.Column('duration_minutes', sa.Integer, nullable=True),
        sa.Column('room_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('rooms.id'), nullable=True),
        sa.Column('venue', sa.String(200), nullable=True),
        sa.Column('max_marks', sa.Float, server_default='100'),
        sa.Column('passing_marks', sa.Float, nullable=True),
        sa.Column('weightage', sa.Float, server_default='100'),
        sa.Column('grade_scale_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('grade_scales.id'), nullable=True),
        sa.Column('instructions', sa.Text, nullable=True),
        sa.Column('status', sa.Enum('DRAFT', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'RESULTS_PENDING', 'RESULTS_PUBLISHED', 'CANCELLED', name='examstatus'), server_default='DRAFT'),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('metadata', postgresql.JSONB, server_default='{}'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=True),
    )
    
    # Exam Results
    op.create_table('exam_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('examination_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('examinations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('marks_obtained', sa.Float, nullable=True),
        sa.Column('grade', sa.String(10), nullable=True),
        sa.Column('grade_point', sa.Float, nullable=True),
        sa.Column('percentage', sa.Float, nullable=True),
        sa.Column('is_absent', sa.Boolean, server_default='false'),
        sa.Column('is_exempted', sa.Boolean, server_default='false'),
        sa.Column('exemption_reason', sa.String(500), nullable=True),
        sa.Column('remarks', sa.String(500), nullable=True),
        sa.Column('verified', sa.Boolean, server_default='false'),
        sa.Column('verified_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('verified_at', sa.DateTime, nullable=True),
        sa.Column('entered_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('entered_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('modified_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('modified_at', sa.DateTime, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=True),
        sa.UniqueConstraint('examination_id', 'student_id', name='uq_exam_result_exam_student'),
    )
    
    # Student GPAs
    op.create_table('student_gpas',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('academic_year', sa.String(20), nullable=False),
        sa.Column('term', sa.String(50), nullable=True),
        sa.Column('gpa', sa.Float, nullable=True),
        sa.Column('cgpa', sa.Float, nullable=True),
        sa.Column('total_credits', sa.Float, server_default='0'),
        sa.Column('earned_credits', sa.Float, server_default='0'),
        sa.Column('rank_in_class', sa.Integer, nullable=True),
        sa.Column('rank_in_section', sa.Integer, nullable=True),
        sa.Column('is_calculated', sa.Boolean, server_default='false'),
        sa.Column('calculated_at', sa.DateTime, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=True),
        sa.UniqueConstraint('student_id', 'academic_year', 'term', name='uq_student_gpa_period'),
    )


def downgrade() -> None:
    # Drop tables in reverse order (respecting foreign key constraints)
    op.drop_table('student_gpas')
    op.drop_table('exam_results')
    op.drop_table('examinations')
    op.drop_table('grade_levels')
    op.drop_table('grade_scales')
    op.drop_table('timetable_conflicts')
    op.drop_table('timetable_entries')
    op.drop_table('rooms')
    op.drop_table('time_slots')
    op.drop_table('certificates')
    op.drop_table('certificate_templates')
    op.drop_table('notification_preferences')
    op.drop_table('notifications')
    op.drop_table('notification_templates')
    
    # Drop enums
    op.execute("DROP TYPE IF EXISTS examstatus")
    op.execute("DROP TYPE IF EXISTS examtype")
    op.execute("DROP TYPE IF EXISTS timetablestatus")
    op.execute("DROP TYPE IF EXISTS dayofweek")
    op.execute("DROP TYPE IF EXISTS timeslottype")
    op.execute("DROP TYPE IF EXISTS certificatestatus")
    op.execute("DROP TYPE IF EXISTS certificatetype")
    op.execute("DROP TYPE IF EXISTS notificationpriority")
    op.execute("DROP TYPE IF EXISTS notificationstatus")
    op.execute("DROP TYPE IF EXISTS notificationtype")
