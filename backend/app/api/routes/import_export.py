"""
Import/Export API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from io import BytesIO

from app.config.database import get_db
from app.core.middleware.auth import get_current_user
from app.models.user import User
from app.models.student import StudentStatus
from app.core.services.import_export_service import ImportExportService

router = APIRouter(prefix="/import-export", tags=["Import/Export"])


# ============== Template Download ==============

@router.get("/templates/students")
async def download_student_template(
    format: str = Query("csv", regex="^(csv|xlsx)$"),
    current_user: User = Depends(get_current_user),
):
    """Download a template for student import."""
    service = ImportExportService(None)  # No DB needed for template
    
    if format == "csv":
        content = service.get_student_import_template()
        return StreamingResponse(
            BytesIO(content),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=student_import_template.csv"
            }
        )
    else:
        # For Excel, we'd need pandas
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Excel template requires pandas. Use CSV format.",
        )


# ============== Student Import ==============

@router.post("/import/students")
async def import_students(
    file: UploadFile = File(...),
    skip_duplicates: bool = Query(True, description="Skip duplicate records"),
    update_existing: bool = Query(False, description="Update existing records instead of skipping"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Import students from CSV or Excel file.
    
    - **file**: CSV or Excel file with student data
    - **skip_duplicates**: If true, skip rows that match existing students (by admission_number or email)
    - **update_existing**: If true, update existing students instead of skipping
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided",
        )
    
    filename = file.filename.lower()
    if not (filename.endswith('.csv') or filename.endswith('.xlsx') or filename.endswith('.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be CSV or Excel format (.csv, .xlsx, .xls)",
        )
    
    # Read file content
    content = await file.read()
    
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty",
        )
    
    service = ImportExportService(db)
    
    try:
        if filename.endswith('.csv'):
            results = await service.import_students_from_csv(
                tenant_id=str(current_user.tenant_id),
                file_content=content,
                skip_duplicates=skip_duplicates,
                update_existing=update_existing,
            )
        else:
            results = await service.import_students_from_excel(
                tenant_id=str(current_user.tenant_id),
                file_content=content,
                skip_duplicates=skip_duplicates,
                update_existing=update_existing,
            )
        
        return {
            "success": True,
            "message": f"Import completed. {results['imported']} students imported, {results['updated']} updated, {results['skipped']} skipped.",
            **results,
        }
        
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}",
        )


# ============== Student Export ==============

@router.get("/export/students")
async def export_students(
    format: str = Query("csv", regex="^(csv|xlsx)$"),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export students to CSV or Excel format.
    
    - **format**: Output format (csv or xlsx)
    - **status**: Filter by student status (active, inactive, etc.)
    """
    service = ImportExportService(db)
    
    student_status = StudentStatus(status_filter) if status_filter else None
    
    try:
        if format == "csv":
            content = await service.export_students_to_csv(
                tenant_id=str(current_user.tenant_id),
                status=student_status,
            )
            return StreamingResponse(
                BytesIO(content),
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=students_export_{current_user.tenant_id}.csv"
                }
            )
        else:
            content = await service.export_students_to_excel(
                tenant_id=str(current_user.tenant_id),
                status=student_status,
            )
            return StreamingResponse(
                BytesIO(content),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": f"attachment; filename=students_export_{current_user.tenant_id}.xlsx"
                }
            )
            
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}",
        )



# ============== Fee Export ==============

@router.get("/export/fees")
async def export_fees(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export fees to CSV."""
    service = ImportExportService(db)
    try:
        content = await service.export_fees_to_csv(str(current_user.tenant_id))
        return StreamingResponse(
            BytesIO(content),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=fees_export_{current_user.tenant_id}.csv"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


# ============== Attendance Export ==============

@router.get("/export/attendance")
async def export_attendance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export attendance to CSV."""
    service = ImportExportService(db)
    try:
        content = await service.export_attendance_to_csv(str(current_user.tenant_id))
        return StreamingResponse(
            BytesIO(content),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=attendance_export_{current_user.tenant_id}.csv"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


# ============== Import Status ==============

@router.get("/import/status/{job_id}")
async def get_import_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Get the status of an import job.
    (For future implementation with background tasks)
    """
    # This would be implemented with Celery for large imports
    return {
        "job_id": job_id,
        "status": "completed",
        "message": "Synchronous import - check the import response for results.",
    }
