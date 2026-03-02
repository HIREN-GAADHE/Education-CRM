"""
Payroll API Routes — RBAC-driven payroll management
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, update, case
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
import logging

from app.config.database import get_db
from app.models.payroll import SalaryStructure, StaffSalaryAssignment, Payslip, PayslipStatus
from app.models.staff import Staff
from app.models.role import Role, UserRole
from app.models.user import User
from app.core.middleware.auth import get_current_user
from app.core.permissions import require_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payroll", tags=["Payroll"])

# ── Role level helpers ─────────────────────────────────────────────────────────

async def _get_role_level(user_id: UUID, db: AsyncSession) -> int:
    """Return the lowest (most privileged) role level for the user."""
    result = await db.execute(
        select(func.min(Role.level))
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    )
    return result.scalar() or 99


async def _get_staff_for_user(user_id: UUID, tenant_id: UUID, db: AsyncSession) -> Optional[Staff]:
    """Return the Staff record linked to a user (if any)."""
    result = await db.execute(
        select(Staff).where(
            Staff.user_id == user_id,
            Staff.tenant_id == tenant_id,
            Staff.is_deleted == False,
        )
    )
    return result.scalar_one_or_none()


# ─────────────────────────────────────────────────────────────────────────────
#  SALARY STRUCTURES
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/structures")
@require_permission("payroll", "read")
async def list_structures(
    request: Request,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List salary structures. Admin / HR only."""
    role_level = await _get_role_level(current_user.id, db)
    if role_level > 5:
        raise HTTPException(status_code=403, detail="Access restricted to HR and Admin roles")

    q = select(SalaryStructure).where(
        SalaryStructure.tenant_id == current_user.tenant_id,
        SalaryStructure.is_deleted == False,
    )
    if is_active is not None:
        q = q.where(SalaryStructure.is_active == is_active)
    q = q.order_by(SalaryStructure.name)
    result = await db.execute(q)
    structures = result.scalars().all()
    return [_struct_dict(s) for s in structures]


@router.post("/structures", status_code=201)
@require_permission("payroll", "create")
async def create_structure(
    request: Request,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a salary structure. Admin / HR only."""
    role_level = await _get_role_level(current_user.id, db)
    if role_level > 5:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    struct = SalaryStructure(
        tenant_id=current_user.tenant_id,
        name=payload.get("name"),
        description=payload.get("description"),
        base_salary=Decimal(str(payload.get("base_salary", 0))),
        allowances=payload.get("allowances", {}),
        deductions=payload.get("deductions", {}),
        is_active=payload.get("is_active", True),
    )
    db.add(struct)
    await db.commit()
    await db.refresh(struct)
    return _struct_dict(struct)


@router.put("/structures/{structure_id}")
@require_permission("payroll", "update")
async def update_structure(
    request: Request,
    structure_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role_level = await _get_role_level(current_user.id, db)
    if role_level > 5:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    result = await db.execute(
        select(SalaryStructure).where(
            SalaryStructure.id == structure_id,
            SalaryStructure.tenant_id == current_user.tenant_id,
            SalaryStructure.is_deleted == False,
        )
    )
    struct = result.scalar_one_or_none()
    if not struct:
        raise HTTPException(status_code=404, detail="Salary structure not found")

    for field in ["name", "description", "base_salary", "allowances", "deductions", "is_active"]:
        if field in payload:
            val = Decimal(str(payload[field])) if field == "base_salary" else payload[field]
            setattr(struct, field, val)

    await db.commit()
    await db.refresh(struct)
    return _struct_dict(struct)


@router.delete("/structures/{structure_id}", status_code=204)
@require_permission("payroll", "delete")
async def delete_structure(
    request: Request,
    structure_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role_level = await _get_role_level(current_user.id, db)
    if role_level > 3:
        raise HTTPException(status_code=403, detail="Only Admins can delete salary structures")

    result = await db.execute(
        select(SalaryStructure).where(
            SalaryStructure.id == structure_id,
            SalaryStructure.tenant_id == current_user.tenant_id,
        )
    )
    struct = result.scalar_one_or_none()
    if not struct:
        raise HTTPException(status_code=404, detail="Not found")
    struct.is_deleted = True
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
#  SALARY ASSIGNMENTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/assignments")
@require_permission("payroll", "read")
async def list_assignments(
    request: Request,
    staff_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role_level = await _get_role_level(current_user.id, db)
    if role_level > 5:
        raise HTTPException(status_code=403, detail="Access restricted to HR and Admin roles")

    from sqlalchemy.orm import selectinload
    q = select(StaffSalaryAssignment).options(
        selectinload(StaffSalaryAssignment.structure)
    ).where(
        StaffSalaryAssignment.tenant_id == current_user.tenant_id,
        StaffSalaryAssignment.is_deleted == False,
    )
    if staff_id:
        q = q.where(StaffSalaryAssignment.staff_id == staff_id)
    q = q.order_by(StaffSalaryAssignment.effective_from.desc())
    result = await db.execute(q)
    assignments = result.unique().scalars().all()
    return [_assignment_dict(a) for a in assignments]


@router.post("/assignments", status_code=201)
@require_permission("payroll", "create")
async def create_assignment(
    request: Request,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role_level = await _get_role_level(current_user.id, db)
    if role_level > 5:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    assignment = StaffSalaryAssignment(
        tenant_id=current_user.tenant_id,
        staff_id=UUID(payload["staff_id"]),
        structure_id=UUID(payload["structure_id"]),
        effective_from=date.fromisoformat(payload["effective_from"]),
        effective_to=date.fromisoformat(payload["effective_to"]) if payload.get("effective_to") else None,
        custom_base_salary=Decimal(str(payload["custom_base_salary"])) if payload.get("custom_base_salary") else None,
        bank_account_number=payload.get("bank_account_number"),
        bank_name=payload.get("bank_name"),
        ifsc_code=payload.get("ifsc_code"),
        pan_number=payload.get("pan_number"),
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return _assignment_dict(assignment)


@router.put("/assignments/{assignment_id}")
@require_permission("payroll", "update")
async def update_assignment(
    request: Request,
    assignment_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role_level = await _get_role_level(current_user.id, db)
    if role_level > 5:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    result = await db.execute(
        select(StaffSalaryAssignment).where(
            StaffSalaryAssignment.id == assignment_id,
            StaffSalaryAssignment.tenant_id == current_user.tenant_id,
            StaffSalaryAssignment.is_deleted == False,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    for field in ["bank_account_number", "bank_name", "ifsc_code", "pan_number"]:
        if field in payload:
            setattr(assignment, field, payload[field])
    if "structure_id" in payload:
        assignment.structure_id = UUID(str(payload["structure_id"]))
    if "custom_base_salary" in payload:
        val = payload["custom_base_salary"]
        assignment.custom_base_salary = Decimal(str(val)) if val else None
    if "effective_to" in payload:
        val = payload["effective_to"]
        assignment.effective_to = date.fromisoformat(val) if val else None

    await db.commit()
    await db.refresh(assignment)
    return _assignment_dict(assignment)


@router.delete("/assignments/{assignment_id}", status_code=204)
@require_permission("payroll", "delete")
async def delete_assignment(
    request: Request,
    assignment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a salary assignment. Admin only."""
    role_level = await _get_role_level(current_user.id, db)
    if role_level > 3:
        raise HTTPException(status_code=403, detail="Only Admins can delete assignments")

    result = await db.execute(
        select(StaffSalaryAssignment).where(
            StaffSalaryAssignment.id == assignment_id,
            StaffSalaryAssignment.tenant_id == current_user.tenant_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    assignment.is_deleted = True
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
#  PAYROLL RUN
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/run", status_code=201)
@require_permission("payroll", "create")
async def run_payroll(
    request: Request,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate payslips for all assigned staff for the given month/year.
    Skips staff who already have a payslip for that month.
    """
    role_level = await _get_role_level(current_user.id, db)
    if role_level > 5:
        raise HTTPException(status_code=403, detail="Only HR/Admin can run payroll")

    month: int = int(payload.get("month", datetime.now().month))
    year: int = int(payload.get("year", datetime.now().year))
    working_days: int = int(payload.get("working_days", 26))

    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Invalid month")

    # Get all active assignments for this tenant
    as_result = await db.execute(
        select(StaffSalaryAssignment, SalaryStructure)
        .join(SalaryStructure, StaffSalaryAssignment.structure_id == SalaryStructure.id)
        .where(
            StaffSalaryAssignment.tenant_id == current_user.tenant_id,
            StaffSalaryAssignment.is_deleted == False,
            StaffSalaryAssignment.effective_from <= date(year, month, 28),
            (StaffSalaryAssignment.effective_to == None) |
            (StaffSalaryAssignment.effective_to >= date(year, month, 1)),
        )
    )
    rows = as_result.fetchall()

    generated = 0
    skipped = 0
    for assignment, structure in rows:
        # Skip if payslip already exists for this month
        existing = await db.execute(
            select(Payslip).where(
                Payslip.staff_id == assignment.staff_id,
                Payslip.month == month,
                Payslip.year == year,
                Payslip.tenant_id == current_user.tenant_id,
                Payslip.is_deleted == False,
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        base = assignment.custom_base_salary or structure.base_salary
        allowances = structure.allowances or {}
        deductions = structure.deductions or {}

        # Compute allowances
        total_allowances = Decimal("0")
        allowances_breakdown = {}
        for name, cfg in allowances.items():
            if cfg.get("type") == "percent":
                amount = (base * Decimal(str(cfg["value"]))) / 100
            else:
                amount = Decimal(str(cfg.get("value", 0)))
            allowances_breakdown[name] = float(amount)
            total_allowances += amount

        gross = base + total_allowances

        # Compute deductions
        total_deduct = Decimal("0")
        deductions_breakdown = {}
        for name, cfg in deductions.items():
            if cfg.get("type") == "percent":
                amount = (gross * Decimal(str(cfg["value"]))) / 100
            else:
                amount = Decimal(str(cfg.get("value", 0)))
            deductions_breakdown[name] = float(amount)
            total_deduct += amount

        net = gross - total_deduct

        payslip = Payslip(
            tenant_id=current_user.tenant_id,
            staff_id=assignment.staff_id,
            assignment_id=assignment.id,
            month=month,
            year=year,
            base_salary=base,
            gross_salary=gross,
            total_deductions=total_deduct,
            net_salary=net,
            allowances_breakdown=allowances_breakdown,
            deductions_breakdown=deductions_breakdown,
            days_worked=working_days,
            status=PayslipStatus.PENDING,
        )
        db.add(payslip)
        generated += 1

    await db.commit()
    return {
        "month": month, "year": year,
        "generated": generated, "skipped": skipped,
        "message": f"Payroll run complete — {generated} payslips generated, {skipped} already existed."
    }


# ─────────────────────────────────────────────────────────────────────────────
#  PAYSLIPS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/payslips")
@require_permission("payroll", "read")
async def list_payslips(
    request: Request,
    month: Optional[int] = None,
    year: Optional[int] = None,
    staff_id: Optional[UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    RBAC:
    - Admin/HR/Finance → see all tenant payslips
    - Staff → see ONLY their own payslip
    """
    role_level = await _get_role_level(current_user.id, db)

    q = select(Payslip).where(
        Payslip.tenant_id == current_user.tenant_id,
        Payslip.is_deleted == False,
    )

    if role_level >= 7:
        # Staff — restrict to own record
        my_staff = await _get_staff_for_user(current_user.id, current_user.tenant_id, db)
        if not my_staff:
            return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 0}
        q = q.where(Payslip.staff_id == my_staff.id)
    else:
        # Admin/HR/Finance — allow optional staff filter
        if staff_id:
            q = q.where(Payslip.staff_id == staff_id)

    if month:
        q = q.where(Payslip.month == month)
    if year:
        q = q.where(Payslip.year == year)
    if status_filter:
        q = q.where(Payslip.status == status_filter)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    offset = (page - 1) * page_size
    q = q.order_by(Payslip.year.desc(), Payslip.month.desc()).offset(offset).limit(page_size)
    result = await db.execute(q)
    payslips = result.scalars().all()

    import math
    return {
        "items": [_payslip_dict(p) for p in payslips],
        "total": total, "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
    }


@router.get("/payslips/{payslip_id}")
@require_permission("payroll", "read")
async def get_payslip(
    request: Request,
    payslip_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role_level = await _get_role_level(current_user.id, db)
    result = await db.execute(
        select(Payslip).where(
            Payslip.id == payslip_id,
            Payslip.tenant_id == current_user.tenant_id,
            Payslip.is_deleted == False,
        )
    )
    payslip = result.scalar_one_or_none()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    # Staff can only view their own
    if role_level >= 7:
        my_staff = await _get_staff_for_user(current_user.id, current_user.tenant_id, db)
        if not my_staff or payslip.staff_id != my_staff.id:
            raise HTTPException(status_code=403, detail="Access denied")

    return _payslip_dict(payslip)


@router.patch("/payslips/{payslip_id}/status")
@require_permission("payroll", "update")
async def update_payslip_status(
    request: Request,
    payslip_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark payslip as paid / on_hold. Finance / Admin only."""
    role_level = await _get_role_level(current_user.id, db)
    if role_level >= 7:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    result = await db.execute(
        select(Payslip).where(
            Payslip.id == payslip_id,
            Payslip.tenant_id == current_user.tenant_id,
            Payslip.is_deleted == False,
        )
    )
    payslip = result.scalar_one_or_none()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    new_status = payload.get("status")
    if new_status not in [s.value for s in PayslipStatus]:
        raise HTTPException(status_code=400, detail="Invalid status")

    payslip.status = new_status
    payslip.remarks = payload.get("remarks", payslip.remarks)
    if new_status == PayslipStatus.PAID:
        payslip.paid_at = datetime.utcnow()
        payslip.paid_by = current_user.id
        payslip.payment_mode = payload.get("payment_mode", "bank_transfer")

    await db.commit()
    await db.refresh(payslip)
    return _payslip_dict(payslip)


@router.patch("/payslips/{payslip_id}/adjustments")
@require_permission("payroll", "update")
async def update_payslip_adjustments(
    request: Request,
    payslip_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update LOP days, bonus, advance deduction and recompute net salary."""
    role_level = await _get_role_level(current_user.id, db)
    if role_level > 5:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    result = await db.execute(
        select(Payslip).where(
            Payslip.id == payslip_id,
            Payslip.tenant_id == current_user.tenant_id,
            Payslip.is_deleted == False,
        )
    )
    payslip = result.scalar_one_or_none()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    if payslip.status == PayslipStatus.PAID:
        raise HTTPException(status_code=400, detail="Cannot adjust a paid payslip")

    lop_days = int(payload.get("loss_of_pay_days", payslip.loss_of_pay_days))
    bonus = Decimal(str(payload.get("bonus", payslip.bonus)))
    advance = Decimal(str(payload.get("advance_deduction", payslip.advance_deduction)))
    days_worked = int(payload.get("days_worked", payslip.days_worked or 26))

    # LOP amount = base / working_days * lop_days
    working_days = int(payload.get("working_days", 26))
    lop_amount = (payslip.base_salary / working_days * lop_days) if lop_days > 0 else Decimal("0")

    net = payslip.gross_salary - payslip.total_deductions - lop_amount - advance + bonus

    payslip.loss_of_pay_days = lop_days
    payslip.loss_of_pay_amount = lop_amount
    payslip.bonus = bonus
    payslip.advance_deduction = advance
    payslip.days_worked = days_worked
    payslip.net_salary = net

    await db.commit()
    await db.refresh(payslip)
    return _payslip_dict(payslip)


@router.delete("/payslips/{payslip_id}", status_code=204)
@require_permission("payroll", "delete")
async def delete_payslip(
    request: Request,
    payslip_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a payslip. Admin only. Cannot delete paid payslips."""
    role_level = await _get_role_level(current_user.id, db)
    if role_level > 3:
        raise HTTPException(status_code=403, detail="Only Admins can delete payslips")

    result = await db.execute(
        select(Payslip).where(
            Payslip.id == payslip_id,
            Payslip.tenant_id == current_user.tenant_id,
        )
    )
    payslip = result.scalar_one_or_none()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    if payslip.status == PayslipStatus.PAID.value:
        raise HTTPException(status_code=400, detail="Cannot delete a paid payslip")
    payslip.is_deleted = True
    await db.commit()


@router.post("/payslips/bulk-pay")
@require_permission("payroll", "update")
async def bulk_pay_payslips(
    request: Request,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all pending payslips as paid for a given month/year."""
    role_level = await _get_role_level(current_user.id, db)
    if role_level >= 7:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    month = int(payload.get("month", 0))
    year = int(payload.get("year", 0))
    payment_mode = payload.get("payment_mode", "bank_transfer")

    if not (1 <= month <= 12 and year >= 2000):
        raise HTTPException(status_code=400, detail="Invalid month/year")

    result = await db.execute(
        select(Payslip).where(
            Payslip.tenant_id == current_user.tenant_id,
            Payslip.month == month,
            Payslip.year == year,
            Payslip.status == PayslipStatus.PENDING.value,
            Payslip.is_deleted == False,
        )
    )
    pending = result.scalars().all()
    count = 0
    for p in pending:
        p.status = PayslipStatus.PAID.value
        p.paid_at = datetime.utcnow()
        p.paid_by = current_user.id
        p.payment_mode = payment_mode
        count += 1

    await db.commit()
    return {"marked_paid": count, "month": month, "year": year}


# ─────────────────────────────────────────────────────────────────────────────
#  Summary endpoint
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/summary")
@require_permission("payroll", "read")
async def payroll_summary(
    request: Request,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role_level = await _get_role_level(current_user.id, db)
    if role_level >= 7:
        raise HTTPException(status_code=403, detail="Access restricted")

    base_filter = and_(
        Payslip.tenant_id == current_user.tenant_id,
        Payslip.month == month,
        Payslip.year == year,
        Payslip.is_deleted == False,
    )
    result = await db.execute(
        select(
            func.count(Payslip.id).label("total"),
            func.coalesce(func.sum(Payslip.net_salary), 0).label("total_net"),
            func.coalesce(func.sum(Payslip.gross_salary), 0).label("total_gross"),
            func.coalesce(func.sum(Payslip.total_deductions), 0).label("total_deductions"),
            func.count(case((Payslip.status == PayslipStatus.PAID.value, 1))).label("paid_count"),
            func.count(case((Payslip.status == PayslipStatus.PENDING.value, 1))).label("pending_count"),
            func.count(case((Payslip.status == PayslipStatus.ON_HOLD.value, 1))).label("on_hold_count"),
        ).where(base_filter)
    )
    row = result.fetchone()
    return {
        "month": month, "year": year,
        "total_payslips": row.total or 0,
        "total_gross": float(row.total_gross),
        "total_net": float(row.total_net),
        "total_deductions": float(row.total_deductions),
        "paid_count": row.paid_count or 0,
        "pending_count": row.pending_count or 0,
        "on_hold_count": row.on_hold_count or 0,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Serializers
# ─────────────────────────────────────────────────────────────────────────────

def _struct_dict(s: SalaryStructure) -> dict:
    return {
        "id": str(s.id), "name": s.name, "description": s.description,
        "base_salary": float(s.base_salary),
        "allowances": s.allowances, "deductions": s.deductions,
        "is_active": s.is_active,
        "created_at": s.created_at.isoformat(),
    }


def _assignment_dict(a: StaffSalaryAssignment) -> dict:
    staff = a.staff
    structure = getattr(a, 'structure', None)
    return {
        "id": str(a.id),
        "staff_id": str(a.staff_id),
        "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None,
        "staff_designation": staff.designation if staff else None,
        "structure_id": str(a.structure_id),
        "structure_name": structure.name if structure else None,
        "effective_from": a.effective_from.isoformat(),
        "effective_to": a.effective_to.isoformat() if a.effective_to else None,
        "custom_base_salary": float(a.custom_base_salary) if a.custom_base_salary else None,
        "bank_account_number": a.bank_account_number,
        "bank_name": a.bank_name, "ifsc_code": a.ifsc_code,
        "pan_number": a.pan_number,
        "created_at": a.created_at.isoformat(),
    }


def _payslip_dict(p: Payslip) -> dict:
    staff = p.staff
    assignment = getattr(p, 'assignment', None)
    structure = getattr(assignment, 'structure', None) if assignment else None
    return {
        "id": str(p.id),
        "staff_id": str(p.staff_id),
        "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None,
        "staff_designation": staff.designation if staff else None,
        "staff_employee_id": staff.employee_id if staff else None,
        "structure_name": structure.name if structure else None,
        "month": p.month, "year": p.year,
        "base_salary": float(p.base_salary),
        "gross_salary": float(p.gross_salary),
        "total_deductions": float(p.total_deductions),
        "net_salary": float(p.net_salary),
        "allowances_breakdown": p.allowances_breakdown,
        "deductions_breakdown": p.deductions_breakdown,
        "days_worked": p.days_worked,
        "loss_of_pay_days": p.loss_of_pay_days,
        "loss_of_pay_amount": float(p.loss_of_pay_amount) if p.loss_of_pay_amount else 0,
        "bonus": float(p.bonus) if p.bonus else 0,
        "advance_deduction": float(p.advance_deduction) if p.advance_deduction else 0,
        "status": p.status, "payment_mode": p.payment_mode,
        "paid_at": p.paid_at.isoformat() if p.paid_at else None,
        "remarks": p.remarks,
        "created_at": p.created_at.isoformat(),
    }
