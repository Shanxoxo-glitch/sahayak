import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey
from app.database import Base

class Admin(Base):
    __tablename__ = "admins"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True)
    department = Column(String(100), nullable=True)   # e.g. "District Welfare Office", "Legal Aid"
    access_level = Column(String(20), nullable=False, default="standard")  # "standard", "superadmin"
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
