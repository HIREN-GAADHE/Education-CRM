from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.tenants import router as tenants_router
from app.api.v1.roles import router as roles_router
from app.api.v1.modules import router as modules_router
from app.api.routes.students import router as students_router
from app.api.routes.fees import router as fees_router
from app.api.routes.staff import router as staff_router
from app.api.routes.calendar import router as calendar_router
from app.api.routes.attendance import router as attendance_router
from app.api.routes.messages import router as messages_router
from app.api.routes.reports import router as reports_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.courses import router as courses_router
from app.api.routes.notifications import router as notifications_router

from app.api.routes.import_export import router as import_export_router
from app.api.routes.timetable import router as timetable_router
from app.api.routes.examinations import router as examinations_router
from app.api.routes.payments import router as payments_router
from app.api.routes.parent_portal import router as parent_portal_router
from app.api.routes.student_portal import router as student_portal_router
from app.api.routes.transport import router as transport_router
from app.api.routes.settings import router as settings_router
from app.api.v1.routes.academic import router as academic_router
from app.api.routes.reminders import router as reminders_router

from app.api.v1.super_admin.routes import router as super_admin_router

api_router = APIRouter()

# Include all routers
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
api_router.include_router(tenants_router, prefix="/tenants", tags=["Tenants"])
api_router.include_router(super_admin_router, prefix="/super-admin", tags=["Super Admin"])
api_router.include_router(roles_router, prefix="/roles", tags=["Roles"])
api_router.include_router(modules_router, prefix="/modules", tags=["Modules"])
api_router.include_router(students_router, tags=["Students"])
api_router.include_router(fees_router, tags=["Fees"])
api_router.include_router(staff_router, tags=["Staff"])
api_router.include_router(calendar_router, tags=["Calendar"])
api_router.include_router(attendance_router, tags=["Attendance"])
api_router.include_router(messages_router, tags=["Messages"])
api_router.include_router(reports_router, tags=["Reports"])
api_router.include_router(dashboard_router, tags=["Dashboard"])
api_router.include_router(academic_router, prefix="/academic", tags=["Academic"]) 
api_router.include_router(courses_router, tags=["Courses"])
api_router.include_router(notifications_router, tags=["Notifications"])

api_router.include_router(import_export_router, tags=["Import/Export"])
api_router.include_router(timetable_router, tags=["Timetable"])
api_router.include_router(examinations_router, tags=["Examinations"])
api_router.include_router(payments_router, tags=["Payments"])
api_router.include_router(parent_portal_router, tags=["Parent Portal"])
api_router.include_router(student_portal_router, tags=["Student Portal"])
api_router.include_router(transport_router, tags=["Transport"])
api_router.include_router(settings_router, tags=["Settings"])
api_router.include_router(reminders_router, tags=["Reminders"])


@api_router.get("/health")
async def api_health():
    """API health check endpoint."""
    return {"status": "ok", "message": "API is running"}



