"""
Transport Management API Routes
- Vehicles CRUD
- Routes with stops CRUD
- Student transport assignments
- Transport fees
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID
from datetime import date, time as dt_time
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
from app.models.staff import Staff

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
    pickup_start_time: Optional[str] = None
    pickup_end_time: Optional[str] = None
    drop_start_time: Optional[str] = None
    drop_end_time: Optional[str] = None
    total_distance_km: Optional[float] = None
    estimated_duration_minutes: Optional[int] = None
    monthly_fee: Optional[float] = None
    stops: List[RouteStopCreate] = []


class RouteUpdate(BaseModel):
    route_name: Optional[str] = None
    route_code: Optional[str] = None
    description: Optional[str] = None
    vehicle_id: Optional[UUID] = None
    driver_id: Optional[UUID] = None
    conductor_id: Optional[UUID] = None
    pickup_start_time: Optional[str] = None
    pickup_end_time: Optional[str] = None
    drop_start_time: Optional[str] = None
    drop_end_time: Optional[str] = None
    total_distance_km: Optional[float] = None
    estimated_duration_minutes: Optional[int] = None
    monthly_fee: Optional[float] = None


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
    vehicle_number: Optional[str] = None
    vehicle_type: Optional[str] = None
    driver_id: Optional[UUID] = None
    driver_name: Optional[str] = None
    conductor_id: Optional[UUID] = None
    conductor_name: Optional[str] = None
    pickup_start_time: Optional[str] = None
    pickup_end_time: Optional[str] = None
    drop_start_time: Optional[str] = None
    drop_end_time: Optional[str] = None
    total_distance_km: Optional[float] = None
    estimated_duration_minutes: Optional[int] = None
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
    student_class: Optional[str] = None
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


class StopReorderItem(BaseModel):
    stop_id: UUID
    stop_order: int


# ──── Helpers ─────────────────────────────────────────────────────────────────

def _time_str(t) -> Optional[str]:
    """Convert a time/str to string for response."""
    if t is None:
        return None
    if isinstance(t, dt_time):
        return t.strftime("%H:%M")
    return str(t)


def _parse_time(s: Optional[str]) -> Optional[dt_time]:
    """Parse HH:MM string to time object."""
    if not s:
        return None
    try:
        parts = s.replace(".", ":").split(":")
        return dt_time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)
    except (ValueError, IndexError):
        return None


def _route_dict(r: TransportRoute, student_count: int = 0) -> dict:
    """Serialize a route with eagerly-loaded relationships."""
    vehicle = r.vehicle
    driver = r.driver
    conductor = r.conductor

    stops = []
    for s in sorted(r.stops, key=lambda x: x.stop_order):
        stops.append(RouteStopResponse(
            id=s.id,
            stop_name=s.stop_name,
            stop_order=s.stop_order,
            address=s.address,
            landmark=s.landmark,
            pickup_time=_time_str(s.pickup_time),
            drop_time=_time_str(s.drop_time),
            monthly_fee=s.monthly_fee,
        ))

    return {
        "id": r.id,
        "route_name": r.route_name,
        "route_code": r.route_code,
        "description": r.description,
        "vehicle_id": r.vehicle_id,
        "vehicle_number": vehicle.vehicle_number if vehicle else None,
        "vehicle_type": vehicle.vehicle_type.value if vehicle and vehicle.vehicle_type else None,
        "driver_id": r.driver_id,
        "driver_name": f"{driver.first_name} {driver.last_name}" if driver else None,
        "conductor_id": r.conductor_id,
        "conductor_name": f"{conductor.first_name} {conductor.last_name}" if conductor else None,
        "pickup_start_time": _time_str(r.pickup_start_time),
        "pickup_end_time": _time_str(r.pickup_end_time),
        "drop_start_time": _time_str(r.drop_start_time),
        "drop_end_time": _time_str(r.drop_end_time),
        "total_distance_km": r.total_distance_km,
        "estimated_duration_minutes": r.estimated_duration_minutes,
        "monthly_fee": r.monthly_fee,
        "status": r.status.value if r.status else "active",
        "stops": stops,
        "student_count": student_count,
    }


# ============== Vehicle Endpoints ==============

@router.get("/vehicles")
@require_permission("transport", "read")
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
@require_permission("transport", "create")
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
@require_permission("transport", "read")
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
@require_permission("transport", "delete")
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


@router.put("/vehicles/{vehicle_id}")
@require_permission("transport", "update")
async def update_vehicle(
    request: Request,
    vehicle_id: UUID,
    data: VehicleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a vehicle."""
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

    try:
        vehicle.vehicle_type = VehicleType(data.vehicle_type)
    except ValueError:
        vehicle.vehicle_type = VehicleType.BUS
    vehicle.vehicle_number = data.vehicle_number
    vehicle.make = data.make
    vehicle.model = data.model
    vehicle.seating_capacity = data.seating_capacity
    vehicle.registration_number = data.registration_number
    vehicle.insurance_number = data.insurance_number
    vehicle.gps_enabled = data.gps_enabled
    vehicle.notes = data.notes
    await db.commit()
    await db.refresh(vehicle)
    return VehicleResponse.model_validate(vehicle)


@router.patch("/vehicles/{vehicle_id}/status")
@require_permission("transport", "update")
async def update_vehicle_status(
    request: Request,
    vehicle_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle vehicle status (active / maintenance / inactive)."""
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
    try:
        vehicle.status = VehicleStatus(payload.get("status", "active"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.commit()
    await db.refresh(vehicle)
    return VehicleResponse.model_validate(vehicle)


# ============== Route Endpoints ==============

def _route_eager_options():
    """Common eager-load options for route queries."""
    return [
        selectinload(TransportRoute.stops),
        selectinload(TransportRoute.vehicle),
        selectinload(TransportRoute.driver),
        selectinload(TransportRoute.conductor),
    ]


@router.get("/routes")
@require_permission("transport", "read")
async def list_routes(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all routes with stops, vehicle, driver — no N+1 queries."""
    tenant_filter = and_(
        TransportRoute.tenant_id == current_user.tenant_id,
        TransportRoute.is_deleted == False,
    )
    query = select(TransportRoute).where(tenant_filter).options(*_route_eager_options())
    
    if status:
        query = query.where(TransportRoute.status == RouteStatus(status))
    
    # Count
    count_query = select(func.count(TransportRoute.id)).where(tenant_filter)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(TransportRoute.route_name)
    
    result = await db.execute(query)
    routes = result.scalars().unique().all()

    # Batch student count — single query for all route IDs
    route_ids = [r.id for r in routes]
    student_counts = {}
    if route_ids:
        sc_result = await db.execute(
            select(
                StudentTransport.route_id,
                func.count(StudentTransport.id).label("cnt"),
            ).where(
                StudentTransport.route_id.in_(route_ids),
                StudentTransport.is_active == True,
            ).group_by(StudentTransport.route_id)
        )
        for row in sc_result:
            student_counts[row.route_id] = row.cnt

    items = [_route_dict(r, student_counts.get(r.id, 0)) for r in routes]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.post("/routes", status_code=status.HTTP_201_CREATED)
@require_permission("transport", "create")
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
        pickup_start_time=_parse_time(data.pickup_start_time),
        pickup_end_time=_parse_time(data.pickup_end_time),
        drop_start_time=_parse_time(data.drop_start_time),
        drop_end_time=_parse_time(data.drop_end_time),
        total_distance_km=data.total_distance_km,
        estimated_duration_minutes=data.estimated_duration_minutes,
        monthly_fee=data.monthly_fee,
        status=RouteStatus.ACTIVE,
    )
    
    db.add(route)
    await db.flush()  # Get the route ID
    
    # Add stops — now includes pickup_time and drop_time
    for stop_data in data.stops:
        stop = RouteStop(
            tenant_id=current_user.tenant_id,
            route_id=route.id,
            stop_name=stop_data.stop_name,
            stop_order=stop_data.stop_order,
            address=stop_data.address,
            landmark=stop_data.landmark,
            pickup_time=_parse_time(stop_data.pickup_time),
            drop_time=_parse_time(stop_data.drop_time),
            monthly_fee=stop_data.monthly_fee,
        )
        db.add(stop)
    
    await db.commit()
    await db.refresh(route)
    
    # Reload with eager relationships
    result = await db.execute(
        select(TransportRoute)
        .where(TransportRoute.id == route.id)
        .options(*_route_eager_options())
    )
    route = result.scalar_one()
    
    return _route_dict(route, 0)


@router.put("/routes/{route_id}")
@require_permission("transport", "update")
async def update_route(
    request: Request,
    route_id: UUID,
    data: RouteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a route's details."""
    result = await db.execute(
        select(TransportRoute).where(
            TransportRoute.id == route_id,
            TransportRoute.tenant_id == current_user.tenant_id,
            TransportRoute.is_deleted == False,
        ).options(*_route_eager_options())
    )
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    update_data = data.model_dump(exclude_unset=True)
    for field in ["route_name", "route_code", "description", "total_distance_km",
                  "estimated_duration_minutes", "monthly_fee"]:
        if field in update_data:
            setattr(route, field, update_data[field])

    if "vehicle_id" in update_data:
        route.vehicle_id = update_data["vehicle_id"]
    if "driver_id" in update_data:
        route.driver_id = update_data["driver_id"]
    if "conductor_id" in update_data:
        route.conductor_id = update_data["conductor_id"]

    for time_field in ["pickup_start_time", "pickup_end_time", "drop_start_time", "drop_end_time"]:
        if time_field in update_data:
            setattr(route, time_field, _parse_time(update_data[time_field]))

    await db.commit()

    # Reload fresh
    result = await db.execute(
        select(TransportRoute).where(TransportRoute.id == route_id)
        .options(*_route_eager_options())
    )
    route = result.scalar_one()

    # Get student count
    sc = await db.execute(
        select(func.count(StudentTransport.id)).where(
            StudentTransport.route_id == route_id,
            StudentTransport.is_active == True,
        )
    )
    return _route_dict(route, sc.scalar() or 0)


@router.delete("/routes/{route_id}")
@require_permission("transport", "delete")
async def delete_route(
    request: Request,
    route_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a route."""
    result = await db.execute(
        select(TransportRoute).where(
            TransportRoute.id == route_id,
            TransportRoute.tenant_id == current_user.tenant_id,
        )
    )
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    route.is_deleted = True
    route.status = RouteStatus.INACTIVE
    await db.commit()
    return {"success": True, "message": "Route deleted"}


@router.patch("/routes/{route_id}/status")
@require_permission("transport", "update")
async def update_route_status(
    request: Request,
    route_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle route status (active / inactive / suspended)."""
    result = await db.execute(
        select(TransportRoute).where(
            TransportRoute.id == route_id,
            TransportRoute.tenant_id == current_user.tenant_id,
            TransportRoute.is_deleted == False
        )
    )
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    try:
        route.status = RouteStatus(payload.get("status", "active"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.commit()
    await db.refresh(route)
    return {"id": str(route.id), "status": route.status.value}


# ============== Stop Endpoints ==============

@router.post("/routes/{route_id}/stops", status_code=status.HTTP_201_CREATED)
@require_permission("transport", "create")
async def add_route_stop(
    request: Request,
    route_id: UUID,
    data: RouteStopCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a stop to a route."""
    route_result = await db.execute(
        select(TransportRoute).where(
            TransportRoute.id == route_id,
            TransportRoute.tenant_id == current_user.tenant_id,
            TransportRoute.is_deleted == False,
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
        pickup_time=_parse_time(data.pickup_time),
        drop_time=_parse_time(data.drop_time),
        monthly_fee=data.monthly_fee,
    )
    
    db.add(stop)
    await db.commit()
    await db.refresh(stop)
    
    return RouteStopResponse(
        id=stop.id,
        stop_name=stop.stop_name,
        stop_order=stop.stop_order,
        address=stop.address,
        landmark=stop.landmark,
        pickup_time=_time_str(stop.pickup_time),
        drop_time=_time_str(stop.drop_time),
        monthly_fee=stop.monthly_fee,
    )


@router.put("/routes/{route_id}/stops/{stop_id}")
@require_permission("transport", "update")
async def update_route_stop(
    request: Request,
    route_id: UUID,
    stop_id: UUID,
    data: RouteStopCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a stop on a route."""
    result = await db.execute(
        select(RouteStop).where(
            RouteStop.id == stop_id,
            RouteStop.route_id == route_id,
            RouteStop.tenant_id == current_user.tenant_id,
        )
    )
    stop = result.scalar_one_or_none()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")

    stop.stop_name = data.stop_name
    stop.stop_order = data.stop_order
    stop.address = data.address
    stop.landmark = data.landmark
    stop.pickup_time = _parse_time(data.pickup_time)
    stop.drop_time = _parse_time(data.drop_time)
    stop.monthly_fee = data.monthly_fee

    await db.commit()
    await db.refresh(stop)

    return RouteStopResponse(
        id=stop.id,
        stop_name=stop.stop_name,
        stop_order=stop.stop_order,
        address=stop.address,
        landmark=stop.landmark,
        pickup_time=_time_str(stop.pickup_time),
        drop_time=_time_str(stop.drop_time),
        monthly_fee=stop.monthly_fee,
    )


@router.delete("/routes/{route_id}/stops/{stop_id}")
@require_permission("transport", "delete")
async def delete_route_stop(
    request: Request,
    route_id: UUID,
    stop_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a stop and reorder remaining stops."""
    result = await db.execute(
        select(RouteStop).where(
            RouteStop.id == stop_id,
            RouteStop.route_id == route_id,
            RouteStop.tenant_id == current_user.tenant_id,
        )
    )
    stop = result.scalar_one_or_none()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")

    deleted_order = stop.stop_order
    await db.delete(stop)
    
    # Reorder remaining stops
    remaining = await db.execute(
        select(RouteStop).where(
            RouteStop.route_id == route_id,
            RouteStop.stop_order > deleted_order,
        ).order_by(RouteStop.stop_order)
    )
    for s in remaining.scalars().all():
        s.stop_order -= 1

    await db.commit()
    return {"success": True, "message": "Stop deleted"}


@router.put("/routes/{route_id}/stops/reorder")
@require_permission("transport", "update")
async def reorder_stops(
    request: Request,
    route_id: UUID,
    items: List[StopReorderItem],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk reorder stops for a route."""
    # Verify route ownership
    route_result = await db.execute(
        select(TransportRoute).where(
            TransportRoute.id == route_id,
            TransportRoute.tenant_id == current_user.tenant_id,
            TransportRoute.is_deleted == False,
        )
    )
    if not route_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Route not found")

    for item in items:
        result = await db.execute(
            select(RouteStop).where(
                RouteStop.id == item.stop_id,
                RouteStop.route_id == route_id,
            )
        )
        stop = result.scalar_one_or_none()
        if stop:
            stop.stop_order = item.stop_order

    await db.commit()
    return {"success": True, "message": f"Reordered {len(items)} stops"}


# ============== Student Transport Assignment ==============

@router.get("/assignments")
@require_permission("transport", "read")
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
        student_name = None
        student_class = None
        if a.student:
            student_name = f"{a.student.first_name} {a.student.last_name}"
            student_class = getattr(a.student, 'class_name', None) or getattr(a.student, 'current_class', None)
        
        route_name = a.route.route_name if a.route else None
        stop_name = a.stop.stop_name if a.stop else None
        
        items.append(StudentTransportResponse(
            id=a.id,
            student_id=a.student_id,
            student_name=student_name,
            student_class=student_class,
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
@require_permission("transport", "create")
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
            TransportRoute.tenant_id == current_user.tenant_id,
            TransportRoute.is_deleted == False,
        )
    )
    route = route_result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Check if already assigned to an active route
    existing = await db.execute(
        select(StudentTransport).where(
            StudentTransport.student_id == data.student_id,
            StudentTransport.tenant_id == current_user.tenant_id,
            StudentTransport.is_active == True
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Student already assigned to a route. Remove the existing assignment first.")
    
    # Determine fee: stop fee > route fee > provided fee
    fee = data.monthly_fee
    if not fee and data.stop_id:
        stop_result = await db.execute(
            select(RouteStop).where(RouteStop.id == data.stop_id)
        )
        stop = stop_result.scalar_one_or_none()
        if stop and stop.monthly_fee:
            fee = stop.monthly_fee
    if not fee:
        fee = route.monthly_fee

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
        monthly_fee=fee,
        is_active=True,
    )
    
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    
    stop_name = None
    if data.stop_id:
        sr = await db.execute(select(RouteStop).where(RouteStop.id == data.stop_id))
        s = sr.scalar_one_or_none()
        stop_name = s.stop_name if s else None

    return StudentTransportResponse(
        id=assignment.id,
        student_id=assignment.student_id,
        student_name=f"{student.first_name} {student.last_name}",
        student_class=getattr(student, 'class_name', None),
        route_id=assignment.route_id,
        route_name=route.route_name,
        stop_id=assignment.stop_id,
        stop_name=stop_name,
        trip_type=assignment.trip_type.value,
        monthly_fee=assignment.monthly_fee,
        is_active=assignment.is_active,
    )


@router.delete("/assignments/{assignment_id}")
@require_permission("transport", "delete")
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
@require_permission("transport", "read")
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
            RouteStop.tenant_id == tenant_id,
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
