"""
Transport Management Models - Vehicles, Routes, Student Transport Assignment
"""
from sqlalchemy import Column, String, Date, Text, Enum as SQLEnum, Integer, Float, Boolean, ForeignKey, Time
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, date, time
import enum

from app.models.base import TenantBaseModel, SoftDeleteMixin


class VehicleType(str, enum.Enum):
    """Types of vehicles."""
    BUS = "bus"
    VAN = "van"
    CAR = "car"
    MINI_BUS = "mini_bus"
    AUTO = "auto"


class VehicleStatus(str, enum.Enum):
    """Vehicle operational status."""
    ACTIVE = "active"
    MAINTENANCE = "maintenance"
    INACTIVE = "inactive"
    RETIRED = "retired"


class RouteStatus(str, enum.Enum):
    """Route status."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class TripType(str, enum.Enum):
    """Type of trip."""
    PICKUP = "pickup"
    DROP = "drop"
    BOTH = "both"


class Vehicle(TenantBaseModel, SoftDeleteMixin):
    """
    Vehicle entity - represents a transport vehicle.
    """
    __tablename__ = "transport_vehicles"
    
    # Vehicle details
    vehicle_number = Column(String(50), nullable=False, index=True)
    vehicle_type = Column(SQLEnum(VehicleType), default=VehicleType.BUS)
    make = Column(String(100), nullable=True)  # e.g., Tata, Ashok Leyland
    model = Column(String(100), nullable=True)
    year_of_manufacture = Column(Integer, nullable=True)
    color = Column(String(50), nullable=True)
    
    # Capacity
    seating_capacity = Column(Integer, nullable=False, default=40)
    standing_capacity = Column(Integer, default=0)
    
    # Registration & Insurance
    registration_number = Column(String(50), nullable=True)
    registration_date = Column(Date, nullable=True)
    registration_expiry = Column(Date, nullable=True)
    insurance_number = Column(String(100), nullable=True)
    insurance_expiry = Column(Date, nullable=True)
    
    # Permit
    permit_number = Column(String(100), nullable=True)
    permit_expiry = Column(Date, nullable=True)
    
    # Fitness
    fitness_certificate_number = Column(String(100), nullable=True)
    fitness_expiry = Column(Date, nullable=True)
    
    # PUC
    puc_number = Column(String(100), nullable=True)
    puc_expiry = Column(Date, nullable=True)
    
    # Driver & Conductor (can be assigned to route instead)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("staff.id", ondelete="SET NULL"), nullable=True)
    conductor_id = Column(UUID(as_uuid=True), ForeignKey("staff.id", ondelete="SET NULL"), nullable=True)
    
    # GPS Tracking
    gps_enabled = Column(Boolean, default=False)
    gps_device_id = Column(String(100), nullable=True)
    
    # Status
    status = Column(SQLEnum(VehicleStatus), default=VehicleStatus.ACTIVE)
    
    # Extra
    notes = Column(Text, nullable=True)
    extra_data = Column(JSONB, default={})
    
    # Relationships
    driver = relationship("Staff", foreign_keys=[driver_id])
    conductor = relationship("Staff", foreign_keys=[conductor_id])
    routes = relationship("TransportRoute", back_populates="vehicle")
    
    def __repr__(self):
        return f"<Vehicle {self.vehicle_number}>"


class TransportRoute(TenantBaseModel, SoftDeleteMixin):
    """
    Transport Route - defines a route with stops.
    """
    __tablename__ = "transport_routes"
    
    # Route details
    route_name = Column(String(200), nullable=False)
    route_code = Column(String(50), nullable=True, index=True)
    description = Column(Text, nullable=True)
    
    # Assigned vehicle
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("transport_vehicles.id", ondelete="SET NULL"), nullable=True)
    
    # Driver & Conductor for this route
    driver_id = Column(UUID(as_uuid=True), ForeignKey("staff.id", ondelete="SET NULL"), nullable=True)
    conductor_id = Column(UUID(as_uuid=True), ForeignKey("staff.id", ondelete="SET NULL"), nullable=True)
    
    # Timings
    pickup_start_time = Column(Time, nullable=True)
    pickup_end_time = Column(Time, nullable=True)
    drop_start_time = Column(Time, nullable=True)
    drop_end_time = Column(Time, nullable=True)
    
    # Distance
    total_distance_km = Column(Float, nullable=True)
    estimated_duration_minutes = Column(Integer, nullable=True)
    
    # Fees
    monthly_fee = Column(Float, nullable=True)
    
    # Status
    status = Column(SQLEnum(RouteStatus), default=RouteStatus.ACTIVE)
    
    # Extra
    notes = Column(Text, nullable=True)
    extra_data = Column(JSONB, default={})
    
    # Relationships
    vehicle = relationship("Vehicle", back_populates="routes")
    driver = relationship("Staff", foreign_keys=[driver_id])
    conductor = relationship("Staff", foreign_keys=[conductor_id])
    stops = relationship("RouteStop", back_populates="route", order_by="RouteStop.stop_order")
    student_assignments = relationship("StudentTransport", back_populates="route")
    
    def __repr__(self):
        return f"<Route {self.route_name}>"


class RouteStop(TenantBaseModel):
    """
    Route Stop - a stop point on a route.
    """
    __tablename__ = "transport_route_stops"
    
    # Route reference
    route_id = Column(UUID(as_uuid=True), ForeignKey("transport_routes.id", ondelete="CASCADE"), nullable=False)
    
    # Stop details
    stop_name = Column(String(200), nullable=False)
    stop_order = Column(Integer, nullable=False, default=1)
    
    # Location
    address = Column(Text, nullable=True)
    landmark = Column(String(200), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    # Timings
    pickup_time = Column(Time, nullable=True)
    drop_time = Column(Time, nullable=True)
    
    # Distance from start
    distance_from_start_km = Column(Float, nullable=True)
    
    # Fees for this stop (if different from route fee)
    monthly_fee = Column(Float, nullable=True)
    
    # Extra
    extra_data = Column(JSONB, default={})
    
    # Relationships
    route = relationship("TransportRoute", back_populates="stops")
    student_assignments = relationship("StudentTransport", back_populates="stop")
    
    def __repr__(self):
        return f"<Stop {self.stop_name} on Route {self.route_id}>"


class StudentTransport(TenantBaseModel):
    """
    Student Transport Assignment - assigns students to routes/stops.
    """
    __tablename__ = "student_transport"
    
    # Student reference
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    
    # Route & Stop
    route_id = Column(UUID(as_uuid=True), ForeignKey("transport_routes.id", ondelete="CASCADE"), nullable=False)
    stop_id = Column(UUID(as_uuid=True), ForeignKey("transport_route_stops.id", ondelete="SET NULL"), nullable=True)
    
    # Trip type
    trip_type = Column(SQLEnum(TripType), default=TripType.BOTH)
    
    # Academic year
    academic_year = Column(String(20), nullable=True)
    
    # Dates
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    
    # Fee details
    monthly_fee = Column(Float, nullable=True)
    fee_paid_till = Column(Date, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Extra
    notes = Column(Text, nullable=True)
    extra_data = Column(JSONB, default={})
    
    # Relationships
    student = relationship("Student", backref="transport_assignments")
    route = relationship("TransportRoute", back_populates="student_assignments")
    stop = relationship("RouteStop", back_populates="student_assignments")
    
    def __repr__(self):
        return f"<StudentTransport student={self.student_id} route={self.route_id}>"


class TransportFee(TenantBaseModel):
    """
    Transport Fee Payment Record.
    """
    __tablename__ = "transport_fees"
    
    # References
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    route_id = Column(UUID(as_uuid=True), ForeignKey("transport_routes.id", ondelete="SET NULL"), nullable=True)
    
    # Fee details
    fee_month = Column(Date, nullable=False)  # First day of the month
    amount = Column(Float, nullable=False)
    discount = Column(Float, default=0)
    fine = Column(Float, default=0)
    total_amount = Column(Float, nullable=False)
    
    # Payment
    amount_paid = Column(Float, default=0)
    payment_date = Column(Date, nullable=True)
    payment_reference = Column(String(100), nullable=True)
    
    # Status
    is_paid = Column(Boolean, default=False)
    
    # Extra
    notes = Column(Text, nullable=True)
    
    # Relationships
    student = relationship("Student", backref="transport_fees")
    route = relationship("TransportRoute")
    
    @property
    def balance(self) -> float:
        return self.total_amount - self.amount_paid
    
    def __repr__(self):
        return f"<TransportFee student={self.student_id} month={self.fee_month}>"
