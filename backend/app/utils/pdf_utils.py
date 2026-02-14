"""
PDF Generation Utilities for Student Documents
- ID Cards
- Fee Receipts  
- Academic Transcripts
"""
from io import BytesIO
from datetime import datetime
from typing import Optional, Dict, Any, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics import renderPDF

try:
    import qrcode
except ImportError:
    qrcode = None


def generate_qr_code(data: str, size: int = 100) -> BytesIO:
    """Generate QR code image as BytesIO"""
    if qrcode is None:
        # Return empty buffer if qrcode not available
        return BytesIO()
    
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer


def generate_id_card_pdf(
    student: Dict[str, Any],
    tenant: Dict[str, Any],
    class_info: Optional[Dict[str, Any]] = None
) -> BytesIO:
    """
    Generate a student ID card PDF
    
    Args:
        student: Student data dictionary
        tenant: Tenant/institution data
        class_info: Optional class information
        
    Returns:
        BytesIO buffer containing the PDF
    """
    buffer = BytesIO()
    
    # ID card dimensions (credit card size: 85.6mm x 53.98mm)
    card_width = 3.375 * inch
    card_height = 2.125 * inch
    
    # Create a larger page to fit the card
    from reportlab.pdfgen import canvas
    c = canvas.Canvas(buffer, pagesize=(card_width + 0.5*inch, card_height + 0.5*inch))
    
    # Card position (centered with margin)
    x_offset = 0.25 * inch
    y_offset = 0.25 * inch
    
    # Draw card background
    c.setFillColor(colors.white)
    c.roundRect(x_offset, y_offset, card_width, card_height, 10, fill=1, stroke=1)
    
    # Header gradient effect (simplified as solid color)
    c.setFillColor(colors.HexColor("#667eea"))
    c.roundRect(x_offset, y_offset + card_height - 0.6*inch, card_width, 0.6*inch, 10, fill=1, stroke=0)
    # Cover bottom corners of header
    c.rect(x_offset, y_offset + card_height - 0.6*inch, card_width, 0.3*inch, fill=1, stroke=0)
    
    # Institution name
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    institution_name = tenant.get("name", "Educational Institution")[:35]
    c.drawCentredString(x_offset + card_width/2, y_offset + card_height - 0.35*inch, institution_name)
    
    # Photo placeholder
    photo_size = 0.8 * inch
    photo_x = x_offset + 0.15*inch
    photo_y = y_offset + card_height - 1.5*inch
    c.setFillColor(colors.HexColor("#e0e0e0"))
    c.rect(photo_x, photo_y, photo_size, photo_size, fill=1, stroke=1)
    c.setFillColor(colors.HexColor("#999999"))
    c.setFont("Helvetica", 6)
    c.drawCentredString(photo_x + photo_size/2, photo_y + photo_size/2, "PHOTO")
    
    # Student details
    c.setFillColor(colors.black)
    details_x = photo_x + photo_size + 0.15*inch
    details_y = photo_y + photo_size - 0.05*inch
    
    # Name
    c.setFont("Helvetica-Bold", 9)
    full_name = f"{student.get('first_name', '')} {student.get('last_name', '')}"[:25]
    c.drawString(details_x, details_y, full_name)
    
    # Admission Number
    c.setFont("Helvetica", 7)
    details_y -= 0.15*inch
    c.drawString(details_x, details_y, f"ID: {student.get('admission_number', 'N/A')}")
    
    # Class/Course
    details_y -= 0.15*inch
    if class_info:
        class_name = f"{class_info.get('name', '')}-{class_info.get('section', '')}"
    else:
        class_name = student.get('course', 'N/A')[:15]
    c.drawString(details_x, details_y, f"Class: {class_name}")
    
    # Blood Group
    details_y -= 0.15*inch
    c.drawString(details_x, details_y, f"Blood: {student.get('blood_group', 'N/A')}")
    
    # Bottom section with contact
    c.setFont("Helvetica", 6)
    c.drawString(x_offset + 0.15*inch, y_offset + 0.35*inch, f"Phone: {student.get('phone', 'N/A')}")
    
    # QR Code (contains student ID for verification)
    qr_size = 0.5 * inch
    qr_x = x_offset + card_width - qr_size - 0.1*inch
    qr_y = y_offset + 0.1*inch
    
    # Draw QR code placeholder
    qr_data = f"STUDENT:{student.get('id', '')}"
    qr_buffer = generate_qr_code(qr_data, 50)
    if qr_buffer.getvalue():
        from reportlab.lib.utils import ImageReader
        qr_img = ImageReader(qr_buffer)
        c.drawImage(qr_img, qr_x, qr_y, width=qr_size, height=qr_size)
    else:
        # Fallback: draw placeholder
        c.setFillColor(colors.HexColor("#f0f0f0"))
        c.rect(qr_x, qr_y, qr_size, qr_size, fill=1, stroke=1)
    
    # Valid until
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 5)
    c.drawString(x_offset + 0.15*inch, y_offset + 0.15*inch, f"Valid: Academic Year {datetime.now().year}-{datetime.now().year + 1}")
    
    c.save()
    buffer.seek(0)
    return buffer


def generate_fee_receipt_pdf(
    payment: Dict[str, Any],
    student: Dict[str, Any],
    tenant: Dict[str, Any]
) -> BytesIO:
    """
    Generate a fee receipt PDF
    
    Args:
        payment: Payment/transaction data
        student: Student data
        tenant: Institution data
        
    Returns:
        BytesIO buffer containing the PDF
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    story = []
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=6,
        alignment=1  # Center
    )
    
    header_style = ParagraphStyle(
        'Header',
        parent=styles['Normal'],
        fontSize=10,
        alignment=1
    )
    
    # Institution Header
    story.append(Paragraph(tenant.get("name", "Educational Institution"), title_style))
    story.append(Paragraph(tenant.get("address", ""), header_style))
    story.append(Spacer(1, 0.3*inch))
    
    # Receipt Title
    story.append(Paragraph("<b>FEE RECEIPT</b>", ParagraphStyle('ReceiptTitle', parent=styles['Heading2'], alignment=1)))
    story.append(Spacer(1, 0.2*inch))
    
    # Receipt details table
    receipt_data = [
        ["Receipt No:", payment.get("transaction_id", "N/A"), "Date:", payment.get("payment_date", datetime.now().strftime("%Y-%m-%d"))],
    ]
    
    receipt_table = Table(receipt_data, colWidths=[1.2*inch, 2*inch, 1*inch, 2*inch])
    receipt_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
    ]))
    story.append(receipt_table)
    story.append(Spacer(1, 0.2*inch))
    
    # Student details
    student_data = [
        ["Student Name:", f"{student.get('first_name', '')} {student.get('last_name', '')}"],
        ["Admission No:", student.get("admission_number", "N/A")],
        ["Course/Class:", student.get("course", "N/A")],
    ]
    
    student_table = Table(student_data, colWidths=[1.5*inch, 4.5*inch])
    student_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(student_table)
    story.append(Spacer(1, 0.3*inch))
    
    # Fee details table
    fee_data = [
        ["Description", "Amount (₹)"],
        [payment.get("description", payment.get("fee_type", "Fee")), f"{payment.get('total_amount', 0):,.2f}"],
    ]
    
    if payment.get("discount_amount", 0) > 0:
        fee_data.append(["Discount", f"-{payment.get('discount_amount', 0):,.2f}"])
    
    if payment.get("fine_amount", 0) > 0:
        fee_data.append(["Fine/Late Fee", f"+{payment.get('fine_amount', 0):,.2f}"])
    
    fee_data.append(["Amount Paid", f"{payment.get('paid_amount', 0):,.2f}"])
    
    balance = payment.get('total_amount', 0) - payment.get('paid_amount', 0) - payment.get('discount_amount', 0) + payment.get('fine_amount', 0)
    if balance > 0:
        fee_data.append(["Balance Due", f"{balance:,.2f}"])
    
    fee_table = Table(fee_data, colWidths=[4*inch, 2*inch])
    fee_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#667eea")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    story.append(fee_table)
    story.append(Spacer(1, 0.3*inch))
    
    # Payment method
    story.append(Paragraph(f"<b>Payment Method:</b> {payment.get('payment_method', 'Cash').upper()}", styles['Normal']))
    if payment.get("payment_reference"):
        story.append(Paragraph(f"<b>Reference:</b> {payment.get('payment_reference')}", styles['Normal']))
    
    story.append(Spacer(1, 0.5*inch))
    
    # Signature
    sig_data = [["", "Authorized Signatory"]]
    sig_table = Table(sig_data, colWidths=[4*inch, 2*inch])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('LINEABOVE', (1, 0), (1, 0), 1, colors.black),
    ]))
    story.append(sig_table)
    
    # Footer
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("<i>This is a computer-generated receipt. No signature required.</i>", 
                          ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, alignment=1)))
    
    doc.build(story)
    buffer.seek(0)
    return buffer


def generate_transcript_pdf(
    student: Dict[str, Any],
    exams: List[Dict[str, Any]],
    tenant: Dict[str, Any],
    academic_info: Optional[Dict[str, Any]] = None
) -> BytesIO:
    """
    Generate an academic transcript PDF
    
    Args:
        student: Student data
        exams: List of exam results
        tenant: Institution data
        academic_info: Optional academic progress info
        
    Returns:
        BytesIO buffer containing the PDF
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    story = []
    
    # Title style
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=6,
        alignment=1
    )
    
    # Institution Header
    story.append(Paragraph(tenant.get("name", "Educational Institution"), title_style))
    story.append(Paragraph("<b>ACADEMIC TRANSCRIPT</b>", 
                          ParagraphStyle('Subtitle', parent=styles['Heading2'], alignment=1, spaceAfter=20)))
    
    # Student Information
    story.append(Paragraph("<b>Student Information</b>", styles['Heading3']))
    
    student_info = [
        ["Name:", f"{student.get('first_name', '')} {student.get('middle_name', '')} {student.get('last_name', '')}".strip()],
        ["Admission No:", student.get("admission_number", "N/A")],
        ["Course:", student.get("course", "N/A")],
        ["Department:", student.get("department", "N/A")],
        ["Date of Birth:", student.get("date_of_birth", "N/A")],
    ]
    
    info_table = Table(student_info, colWidths=[1.5*inch, 4.5*inch])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 0.3*inch))
    
    # Academic Records
    story.append(Paragraph("<b>Academic Records</b>", styles['Heading3']))
    
    if exams:
        # Table header
        exam_data = [["Exam", "Subject", "Max Marks", "Obtained", "Grade", "Result"]]
        
        for exam in exams:
            result = "PASS" if exam.get("is_passed", exam.get("marks_obtained", 0) >= exam.get("passing_marks", 0)) else "FAIL"
            exam_data.append([
                exam.get("exam_name", "N/A")[:20],
                exam.get("subject", "N/A")[:20],
                str(exam.get("max_marks", 100)),
                str(exam.get("marks_obtained", 0)),
                exam.get("grade", "-"),
                result
            ])
        
        exam_table = Table(exam_data, colWidths=[1.2*inch, 1.5*inch, 0.8*inch, 0.8*inch, 0.6*inch, 0.7*inch])
        exam_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#667eea")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        story.append(exam_table)
    else:
        story.append(Paragraph("No examination records available.", styles['Normal']))
    
    story.append(Spacer(1, 0.3*inch))
    
    # Summary
    if academic_info:
        story.append(Paragraph("<b>Summary</b>", styles['Heading3']))
        summary_data = []
        
        if academic_info.get("cgpa"):
            summary_data.append(["CGPA:", str(academic_info.get("cgpa"))])
        if academic_info.get("total_credits"):
            summary_data.append(["Total Credits:", str(academic_info.get("total_credits"))])
        
        if summary_data:
            summary_table = Table(summary_data, colWidths=[1.5*inch, 2*inch])
            summary_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
            ]))
            story.append(summary_table)
    
    story.append(Spacer(1, 0.5*inch))
    
    # Footer
    story.append(Paragraph(f"<i>Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M')}</i>", 
                          ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8)))
    story.append(Spacer(1, 0.3*inch))
    
    # Signature section
    sig_data = [
        ["", "", ""],
        ["Controller of Examinations", "", "Principal/Director"]
    ]
    sig_table = Table(sig_data, colWidths=[2*inch, 2*inch, 2*inch])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('LINEABOVE', (0, 1), (0, 1), 1, colors.black),
        ('LINEABOVE', (2, 1), (2, 1), 1, colors.black),
        ('TOPPADDING', (0, 1), (-1, 1), 10),
    ]))
    story.append(sig_table)
    
    doc.build(story)
    buffer.seek(0)
    return buffer
