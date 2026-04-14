from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from common.database import Base


class User(Base):
    __tablename__ = "users"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email             = Column(String, unique=True, index=True, nullable=False)
    hashed_password   = Column(String, nullable=False)
    full_name         = Column(String, nullable=True)
    bio               = Column(Text, nullable=True)

    # Profile fields collected at signup or updated later
    target_role       = Column(String, nullable=True)
    experience_years  = Column(Integer, nullable=True)
    education         = Column(String, nullable=True)
    skills            = Column(Text, nullable=True)      # JSON or CSV

    # Social links
    github_url        = Column(String, nullable=True)
    linkedin_url      = Column(String, nullable=True)
    portfolio_url     = Column(String, nullable=True)

    # Status
    is_verified       = Column(Boolean, default=False)
    is_active         = Column(Boolean, default=True)

    last_login_at     = Column(DateTime, nullable=True)
    created_at        = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
