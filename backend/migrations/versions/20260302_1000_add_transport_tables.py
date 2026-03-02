"""add_transport_tables

Revision ID: add_transport_tables
Revises: add_payroll_tables
Create Date: 2026-03-02 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_transport_tables'
down_revision = 'add_payroll_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Create ENUMs ─────────────────────────────────────────────────────────
    vehicle_type_enum = postgresql.ENUM(
        'bus', 'van', 'car', 'mini_bus', 'auto',
        name='vehicletype', create_type=False
    )
    vehicle_status_enum = postgresql.ENUM(
        'active', 'maintenance', 'inactive', 'retired',
        name='vehiclestatus', create_type=False
    )
    route_status_enum = postgresql.ENUM(
        'active', 'inactive', 'suspended',
        name='routestatus', create_type=False
    )
    trip_type_enum = postgresql.ENUM(
        'pickup', 'drop', 'both',
        name='triptype', create_type=False
    )

    op.execute("CREATE TYPE IF NOT EXISTS vehicletype AS ENUM ('bus','van','car','mini_bus','auto')")
    op.execute("CREATE TYPE IF NOT EXISTS vehiclestatus AS ENUM ('active','maintenance','inactive','retired')")
    op.execute("CREATE TYPE IF NOT EXISTS routestatus AS ENUM ('active','inactive','suspended')")
    op.execute("CREATE TYPE IF NOT EXISTS triptype AS ENUM ('pickup','drop','both')")

    # ── transport_vehicles ────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS transport_vehicles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE,
            deleted_by UUID,
            vehicle_number VARCHAR(50) NOT NULL,
            vehicle_type vehicletype DEFAULT 'bus',
            make VARCHAR(100),
            model VARCHAR(100),
            year_of_manufacture INTEGER,
            color VARCHAR(50),
            seating_capacity INTEGER NOT NULL DEFAULT 40,
            standing_capacity INTEGER DEFAULT 0,
            registration_number VARCHAR(50),
            registration_date DATE,
            registration_expiry DATE,
            insurance_number VARCHAR(100),
            insurance_expiry DATE,
            permit_number VARCHAR(100),
            permit_expiry DATE,
            fitness_certificate_number VARCHAR(100),
            fitness_expiry DATE,
            puc_number VARCHAR(100),
            puc_expiry DATE,
            driver_id UUID REFERENCES staff(id) ON DELETE SET NULL,
            conductor_id UUID REFERENCES staff(id) ON DELETE SET NULL,
            gps_enabled BOOLEAN DEFAULT FALSE,
            gps_device_id VARCHAR(100),
            status vehiclestatus DEFAULT 'active',
            notes TEXT,
            extra_data JSONB DEFAULT '{}'::jsonb
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_transport_vehicles_vehicle_number ON transport_vehicles(vehicle_number)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_transport_vehicles_tenant_id ON transport_vehicles(tenant_id)")

    # ── transport_routes ─────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS transport_routes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE,
            deleted_by UUID,
            route_name VARCHAR(200) NOT NULL,
            route_code VARCHAR(50),
            description TEXT,
            vehicle_id UUID REFERENCES transport_vehicles(id) ON DELETE SET NULL,
            driver_id UUID REFERENCES staff(id) ON DELETE SET NULL,
            conductor_id UUID REFERENCES staff(id) ON DELETE SET NULL,
            pickup_start_time TIME,
            pickup_end_time TIME,
            drop_start_time TIME,
            drop_end_time TIME,
            total_distance_km FLOAT,
            estimated_duration_minutes INTEGER,
            monthly_fee FLOAT,
            status routestatus DEFAULT 'active',
            notes TEXT,
            extra_data JSONB DEFAULT '{}'::jsonb
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_transport_routes_route_code ON transport_routes(route_code)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_transport_routes_tenant_id ON transport_routes(tenant_id)")

    # ── transport_route_stops ────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS transport_route_stops (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            route_id UUID NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
            stop_name VARCHAR(200) NOT NULL,
            stop_order INTEGER NOT NULL DEFAULT 1,
            address TEXT,
            landmark VARCHAR(200),
            latitude FLOAT,
            longitude FLOAT,
            pickup_time TIME,
            drop_time TIME,
            distance_from_start_km FLOAT,
            monthly_fee FLOAT,
            extra_data JSONB DEFAULT '{}'::jsonb
        )
    """)

    # ── student_transport ────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS student_transport (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
            route_id UUID NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
            stop_id UUID REFERENCES transport_route_stops(id) ON DELETE SET NULL,
            trip_type triptype DEFAULT 'both',
            academic_year VARCHAR(20),
            start_date DATE,
            end_date DATE,
            monthly_fee FLOAT,
            fee_paid_till DATE,
            is_active BOOLEAN DEFAULT TRUE,
            notes TEXT,
            extra_data JSONB DEFAULT '{}'::jsonb
        )
    """)

    # ── transport_fees ───────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS transport_fees (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
            route_id UUID REFERENCES transport_routes(id) ON DELETE SET NULL,
            fee_month DATE NOT NULL,
            amount FLOAT NOT NULL,
            discount FLOAT DEFAULT 0,
            fine FLOAT DEFAULT 0,
            total_amount FLOAT NOT NULL,
            amount_paid FLOAT DEFAULT 0,
            payment_date DATE,
            payment_reference VARCHAR(100),
            is_paid BOOLEAN DEFAULT FALSE,
            notes TEXT
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS transport_fees CASCADE")
    op.execute("DROP TABLE IF EXISTS student_transport CASCADE")
    op.execute("DROP TABLE IF EXISTS transport_route_stops CASCADE")
    op.execute("DROP TABLE IF EXISTS transport_routes CASCADE")
    op.execute("DROP TABLE IF EXISTS transport_vehicles CASCADE")
    op.execute("DROP TYPE IF EXISTS triptype")
    op.execute("DROP TYPE IF EXISTS routestatus")
    op.execute("DROP TYPE IF EXISTS vehiclestatus")
    op.execute("DROP TYPE IF EXISTS vehicletype")
