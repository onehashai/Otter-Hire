from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7

SUPPORTED_JOBS_PAGE_LANGUAGES = ("en", "es", "fr", "de", "pt", "browser")


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    name = Column(String, nullable=False)
    website = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    # "browser" means use visitor's browser language; otherwise a BCP-47 code like "en", "es"
    jobs_page_language = Column(String(16), nullable=False, server_default="en")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    integration_credentials = relationship(
        "IntegrationCredential", back_populates="organization", cascade="all, delete-orphan"
    )
