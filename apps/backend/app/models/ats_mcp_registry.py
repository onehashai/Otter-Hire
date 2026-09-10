from sqlalchemy import Column, Date, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class AtsMcpRegistry(Base):
    __tablename__ = "ats_mcp_registry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    ats_name = Column(String(80), nullable=False, unique=True, index=True)
    mcp_status = Column(String(32), nullable=False, index=True)
    mcp_server_url = Column(String(500), nullable=True)
    auth_type = Column(String(32), nullable=False, server_default="none_available")
    last_verified_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    supported_operations = Column(JSONB, nullable=False, server_default="[]")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
