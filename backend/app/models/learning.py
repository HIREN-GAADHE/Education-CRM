from sqlalchemy import Column, String, Text, Integer, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.models.base import TenantBaseModel

class ContentType(str, enum.Enum):
    VIDEO = "video"
    DOCUMENT = "document"
    LINK = "link"

class LearningModule(TenantBaseModel):
    """
    Represents a training module or course in the L&D Hub.
    """
    __tablename__ = "learning_modules"
    
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    thumbnail = Column(String(255), nullable=True) # URL to image
    category = Column(String(100), nullable=True)
    is_published = Column(Boolean, default=True)
    
    # Relationships
    contents = relationship("LearningContent", back_populates="module", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<LearningModule {self.title}>"

class LearningContent(TenantBaseModel):
    """
    Individual content items within a module (videos, docs).
    """
    __tablename__ = "learning_contents"
    
    module_id = Column(UUID(as_uuid=True), ForeignKey("learning_modules.id"), nullable=False, index=True)
    
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    content_type = Column(SQLEnum(ContentType, values_callable=lambda x: [e.value for e in x]), default=ContentType.VIDEO)
    content_url = Column(Text, nullable=False)
    duration_seconds = Column(Integer, nullable=True) # For video duration
    order = Column(Integer, default=0)
    
    module = relationship("LearningModule", back_populates="contents")
    
    def __repr__(self):
        return f"<LearningContent {self.title} ({self.content_type})>"
