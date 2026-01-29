"""
Transport Management API Routes
- Vehicles CRUD
- Routes with stops CRUD
- Student transport assignments
- Transport fees
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID
from datetime import date
from pydantic import BaseModel, Field

from app.config.database import get_db
from app.core.middleware.auth import get_current_user
from app.core.permissions import require_permission
from app.models.user import User
from app.models.transport import (
    Vehicle, TransportRoute, RouteStop, StudentTransport, TransportFee,
    VehicleType, VehicleStatus, RouteStatus, TripType
)
from app.models.student import Student

router = APIRouter(prefix="/transport", tags=["Transport"])


# ============== Pydantic Schemas ==============

class VehicleCreate(BaseModel):
    vehicle_number: str = Field(..., min_length=1, max_length=50)
    vehicle_type: str = "bus"
    make: Optional[str] = None
    model: Optional[str] = None
    seating_capacity: int = 40
    registration_number: Optional[str] = None
    insurance_number: Optional[str] = None
    driver_id: Optional[UUID] = None
    conductor_id: Optional[UUID] = None
    gps_enabled: bool = False
    notes: Optional[str] = None


class VehicleResponse(BaseModel):
    id: UUID
    vehicle_number: str
    vehicle_type: str
    make: Optional[str] = None
    model: Optional[str] = None
    seating_capacity: int
    status: str
    gps_enabled: bool
    driver_id: Optional[UUID] = None
    conductor_id: Optional[UUID] = None
    
    class Config:
        from_attributes = True


class RouteStopCreate(BaseModel):
    stop_name: str
    stop_order: int = 1
    address: Optional[str] = None
    landmark: Optional[str] = None
    pickup_time: Optional[str] = None
    drop_time: Optional[str] = None
    monthly_fee: Optional[float] = None


class RouteCreate(BaseModel):
    route_name: str = Field(..., min_length=1, max_length=200)
    route_code: Optional[str] = None
    description: Optional[str] = None
    vehicle_id: Optional[UUID] = None
    driver_id: Optional[UUID] = None
    conductor_id: Optional[UUID] = None
    monthly_fee: Optional[float] = None
    stops: List[RouteStopCreate] = []


class RouteStopResponse(BaseModel):
    id: UUID
    stop_name: str
    stop_order: int
    address: Optional[str] = None
    landmark: Optional[str] = None
    pickup_time: Optional[str] = None
    drop_time: Optional[str] = None
    monthly_fee: Optional[float] = None
    
    class Config:
        from_attributes = True


class RouteResponse(BaseModel):
    id: UUID
    route_name: str
    route_code: Optional[str] = None
    description: Optional[str] = None
    vehicle_id: Optional[UUID] = None
    monthly_fee: Optional[float] = None
    status: str
    stops: List[RouteStopResponse] = []
    student_count: int = 0
    
    class Config:
        from_attributes = True


class StudentTransportCreate(BaseModel):
    student_id: UUID
    route_id: UUID
    stop_id: Optional[UUID] = None
    trip_type: str = "both"
    academic_year: Optional[str] = None
    monthly_fee: Optional[float] = None


class StudentTransportResponse(BaseModel):
    id: UUID
    student_id: UUID
    student_name: Optional[str] = None
    route_id: UUID
    route_name: Optional[str] = None
    stop_id: Optional[UUID] = None
    stop_name: Optional[str] = None
    trip_type: str
    monthly_fee: Optional[float] = None
    is_active: bool
    
    class Config:
        from_attributes = True


class TransportStats(BaseModel):
    total_vehicles: int
    active_vehicles: int
    total_routes: int
    active_routes: int
    total_students: int
    total_stops: int


# ============== Vehicle Endpoints ==============

@router.get("/vehicles")
@require_permission("transport", "read", module="TRANSPORT")
async def list_vehicles(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all vehicles."""
    query = select(Vehicle).where(
        Vehicle.tenant_id == current_user.tenant_id,
        Vehicle.is_deleted == False
    )
    
    if status:
        query = query.where(Vehicle.status == VehicleStatus(status))
    
    # Count
    count_query = select(func.count(Vehicle.id)).where(
        Vehicle.tenant_id == current_user.tenant_id,
        Vehicle.is_deleted == False
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Vehicle.created_at.desc())
    
    result = await db.execute(query)
    vehicles = result.scalars().all()
    
    return {
        "items": [VehicleResponse.model_validate(v) for v in vehicles],
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.post("/vehicles", status_code=status.HTTP_201_CREATED)
@require_permission("transport", "create", module="TRANSPORT")
async def create_vehicle(
    request: Request,
    data: VehicleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new vehicle."""
    try:
        vehicle_type = VehicleType(data.vehicle_type)
    except ValueError:
        vehicle_type = VehicleType.BUS
    
    vehicle = Vehicle(
        tenant_id=current_user.tenant_id,
        vehicle_number=data.vehicle_number,
        vehicle_type=vehicle_type,
        make=data.make,
        model=data.model,
        seating_capacity=data.seating_capacity,
        registration_number=data.registration_number,
        insurance_number=data.insurance_number,
        driver_id=data.driver_id,
        conductor_id=data.conductor_id,
        gps_enabled=data.gps_enabled,
        notes=data.notes,
        status=VehicleStatus.ACTIVE,
    )
    
    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)
    
    return VehicleResponse.model_validate(vehicle)


@router.get("/vehicles/{vehicle_id}")
@require_permission("transport", "read", module="TRANSPORT")
async def get_vehicle(
    request: Request,
    vehicle_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific vehicle."""
    result = await db.execute(
        select(Vehicle).where(
            Vehicle.id == vehicle_id,
            Vehicle.tenant_id == current_user.tenant_id,
            Vehicle.is_deleted == False
        )
    )
    vehicle = result.scalar_one_or_none()
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    return VehicleResponse.model_validate(vehicle)


@router.delete("/vehicles/{vehicle_id}")
@require_permission("transport", "delete", module="TRANSPORT")
async def delete_vehicle(
    request: Request,
    vehicle_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a vehicle (soft delete)."""
    result = await db.execute(
        select(Vehicle).where(
            Vehicle.id == vehicle_id,
            Vehicle.tenant_id == current_user.tenant_id
        )
    )
    vehicle = result.scalar_one_or_none()
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    vehicle.is_deleted = True
    vehicle.status = VehicleStatus.INACTIVE
    await db.commit()
    
    return {"success": True, "message": "Vehicle deleted"}


# ============== Route Endpoints ==============

@router.get("/routes")
@require_permission("transport", "read", module="TRANSPORT")
async def list_routes(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all routes with stops."""
    query = select(TransportRoute).where(
        TransportRoute.tenant_id == current_user.tenant_id,
        TransportRoute.is_deleted == False
    ).options(selectinload(TransportRoute.stops))
    
    if status:
        query = query.where(TransportRoute.status == RouteStatus(status))
    
    # Count
    count_query = select(func.count(TransportRoute.id)).where(
        TransportRoute.tenant_id == current_user.tenant_id,
        TransportRoute.is_deleted == False
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(TransportRoute.route_name)
    
    result = await db.execute(query)
    routes = result.scalars().unique().all()
    
    items = []
    for r in routes:
        # Get student count for this route
        student_count_result = await db.execute(
            select(func.count(StudentTransport.id)).where(
                StudentTransport.route_id == r.id,
                StudentTransport.is_active == True
            )
        )
        student_count = student_count_result.scalar() or 0
        
        route_dict = {
            "id": r.id,
            "route_name": r.route_name,
            "route_code": r.route_code,
            "description": r.description,
            "vehicle_id": r.vehicle_id,
            "monthly_fee": r.monthly_fee,
            "status": r.status.value if r.status else "active",
            "stops": [RouteStopResponse.model_validate(s) for s in r.stops],
            "student_count": student_count
        }
        items.append(route_dict)
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.post("/routes", status_code=status.HTTP_201_CREATED)
@require_permission("transport", "create", module="TRANSPORT")
async def create_route(
    request: Request,
    data: RouteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new route with stops."""
    route = TransportRoute(
        tenant_id=current_user.tenant_id,
        route_name=data.route_name,
        route_code=data.route_code,
        description=data.description,
        vehicle_id=data.vehicle_id,
        driver_id=data.driver_id,
        conductor_id=data.conductor_id,
        monthly_fee=data.monthly_fee,
        status=RouteStatus.ACTIVE,
    )
    
    db.add(route)
    await db.flush()  # Get the route ID
    
    # Add stops
    for stop_data in data.stops:
        stop = RouteStop(
            tenant_id=current_user.tenant_id,
            route_id=route.id,
            stop_name=stop_data.stop_name,
            stop_order=stop_data.stop_order,
            address=stop_data.address,
            landmark=stop_data.landmark,
            monthly_fee=stop_data.monthly_fee,
        )
        db.add(stop)
    
    await db.commit()
    await db.refresh(route)
    
    # Reload with stops
    result = await db.execute(
        select(TransportRoute)
        .where(TransportRoute.id == route.id)
        .options(selectinload(TransportRoute.stops))
    )
    route = result.scalar_one()
    
    return RouteResponse(
        id=route.id,
        route_name=route.route_name,
        route_code=route.route_code,
        description=route.description,
        vehicle_id=route.vehicle_id,
        monthly_fee=route.monthly_fee,
        status=route.status.value,
        stops=[RouteStopResponse.model_validate(s) for s in route.stops],
        student_count=0
    )


@router.post("/routes/{route_id}/stops", status_code=status.HTTP_201_CREATED)
@require_permission("transport", "create", module="TRANSPORT")
async def add_route_stop(
    request: Request,
    route_id: UUID,
    data: RouteStopCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a stop to a route."""
    # Verify route exists
    route_result = await db.execute(
        select(TransportRoute).where(
            TransportRoute.id == route_id,
            TransportRoute.tenant_id == current_user.tenant_id
        )
    )
    route = route_result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    stop = RouteStop(
        tenant_id=current_user.tenant_id,
        route_id=route_id,
        stop_name=data.stop_name,
        stop_order=data.stop_order,
        address=data.address,
        landmark=data.landmark,
        monthly_fee=data.monthly_fee,
    )
    
    db.add(stop)
    await db.commit()
    await db.refresh(stop)
    
    return RouteStopResponse.model_validate(stop)


# ============== Student Transport Assignment ==============

@router.get("/assignments")
@require_permission("transport", "read", module="TRANSPORT")
async def list_student_assignments(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    route_id: Optional[UUID] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List student transport assignments."""
    query = select(StudentTransport).where(
        StudentTransport.tenant_id == current_user.tenant_id
    ).options(
        selectinload(StudentTransport.student),
        selectinload(StudentTransport.route),
        selectinload(StudentTransport.stop)
    )
    
    if route_id:
        query = query.where(StudentTransport.route_id == route_id)
    
    if active_only:
        query = query.where(StudentTransport.is_active == True)
    
    # Count
    count_query = select(func.count(StudentTransport.id)).where(
        StudentTransport.tenant_id == current_user.tenant_id
    )
    if route_id:
        count_query = count_query.where(StudentTransport.route_id == route_id)
    if active_only:
        count_query = count_query.where(StudentTransport.is_active == True)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    result = await db.execute(query)
    assignments = result.scalars().unique().all()
    
    items = []
    for a in assignments:
        # Use eager-loaded relationships (no extra DB calls)
        student_name = None
        if a.student:
            student_name = f"{a.student.first_name} {a.student.last_name}"
        
        route_name = a.route.route_name if a.route else None
        stop_name = a.stop.stop_name if a.stop else None
        
        items.append(StudentTransportResponse(
            id=a.id,
            student_id=a.student_id,
            student_name=student_name,
            route_id=a.route_id,
            route_name=route_name,
            stop_id=a.stop_id,
            stop_name=stop_name,
            trip_type=a.trip_type.value if a.trip_type else "both",
            monthly_fee=a.monthly_fee,
            is_active=a.is_active,
        ))
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.post("/assignments", status_code=status.HTTP_201_CREATED)
@require_permission("transport", "create", module="TRANSPORT")
async def assign_student_transport(
    request: Request,
    data: StudentTransportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Assign a student to a transport route."""
    # Verify student exists
    student_result = await db.execute(
        select(Student).where(
            Student.id == data.student_id,
            Student.tenant_id == current_user.tenant_id
        )
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Verify route exists
    route_result = await db.execute(
        select(TransportRoute).where(
            TransportRoute.id == data.route_id,
            TransportRoute.tenant_id == current_user.tenant_id
        )
    )
    route = route_result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Check if already assigned
    existing = await db.execute(
        select(StudentTransport).where(
            StudentTransport.student_id == data.student_id,
            StudentTransport.is_active == True
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Student already assigned to a route")
    
    try:
        trip_type = TripType(data.trip_type)
    except ValueError:
        trip_type = TripType.BOTH
    
    assignment = StudentTransport(
        tenant_id=current_user.tenant_id,
        student_id=data.student_id,
        route_id=data.route_id,
        stop_id=data.stop_id,
        trip_type=trip_type,
        academic_year=data.academic_year,
        monthly_fee=data.monthly_fee or route.monthly_fee,
        is_active=True,
    )
    
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    
    return StudentTransportResponse(
        id=assignment.id,
        student_id=assignment.student_id,
        student_name=f"{student.first_name} {student.last_name}",
        route_id=assignment.route_id,
        route_name=route.route_name,
        stop_id=assignment.stop_id,
        stop_name=None,
        trip_type=assignment.trip_type.value,
        monthly_fee=assignment.monthly_fee,
        is_active=assignment.is_active,
    )


@router.delete("/assignments/{assignment_id}")
@require_permission("transport", "delete", module="TRANSPORT")
async def remove_student_transport(
    request: Request,
    assignment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a student transport assignment."""
    result = await db.execute(
        select(StudentTransport).where(
            StudentTransport.id == assignment_id,
            StudentTransport.tenant_id == current_user.tenant_id
        )
    )
    assignment = result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    assignment.is_active = False
    await db.commit()
    
    return {"success": True, "message": "Assignment removed"}


# ============== Statistics ==============

@router.get("/stats", response_model=TransportStats)
@require_permission("transport", "read", module="TRANSPORT")
async def get_transport_stats(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get transport statistics."""
    tenant_id = current_user.tenant_id
    
    # Vehicles
    total_vehicles = await db.execute(
        select(func.count(Vehicle.id)).where(
            Vehicle.tenant_id == tenant_id,
            Vehicle.is_deleted == False
        )
    )
    active_vehicles = await db.execute(
        select(func.count(Vehicle.id)).where(
            Vehicle.tenant_id == tenant_id,
            Vehicle.is_deleted == False,
            Vehicle.status == VehicleStatus.ACTIVE
        )
    )
    
    # Routes
    total_routes = await db.execute(
        select(func.count(TransportRoute.id)).where(
            TransportRoute.tenant_id == tenant_id,
            TransportRoute.is_deleted == False
        )
    )
    active_routes = await db.execute(
        select(func.count(TransportRoute.id)).where(
            TransportRoute.tenant_id == tenant_id,
            TransportRoute.is_deleted == False,
            TransportRoute.status == RouteStatus.ACTIVE
        )
    )
    
    # Students
    total_students = await db.execute(
        select(func.count(StudentTransport.id)).where(
            StudentTransport.tenant_id == tenant_id,
            StudentTransport.is_active == True
        )
    )
    
    # Stops
    total_stops = await db.execute(
        select(func.count(RouteStop.id)).where(
            RouteStop.tenant_id == tenant_id
        )
    )
    
    return TransportStats(
        total_vehicles=total_vehicles.scalar() or 0,
        active_vehicles=active_vehicles.scalar() or 0,
        total_routes=total_routes.scalar() or 0,
        active_routes=active_routes.scalar() or 0,
        total_students=total_students.scalar() or 0,
        total_stops=total_stops.scalar() or 0,
    )
