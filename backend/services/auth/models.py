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
    resume_text       = Column(Text, nullable=True)      # extracted text from uploaded resume

    # Social links
    github_url        = Column(String, nullable=True)
    linkedin_url      = Column(String, nullable=True)
    portfolio_url     = Column(String, nullable=True)

    # Status
    is_verified       = Column(Boolean, default=False)
    is_active         = Column(Boolean, default=True)

    last_login_at     = Column(DateTime, nullable=True)
    privacy_accepted_at = Column(DateTime, nullable=True)  # when the privacy notice was last accepted
    created_at        = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Feedback(Base):
    """Support requests and reviews. Kept even if email delivery fails, so nothing is lost."""
    __tablename__ = "feedback"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kind        = Column(String, nullable=False)          # support | review
    category    = Column(String, nullable=True)           # support topic
    rating      = Column(Integer, nullable=True)          # review stars, 1-5
    message     = Column(Text, nullable=False)
    email       = Column(String, nullable=False)          # where the reply goes
    user_id     = Column(UUID(as_uuid=True), index=True, nullable=True)  # null when sent signed out
    page        = Column(String, nullable=True)           # where in the app it was sent from
    created_at  = Column(DateTime, default=datetime.utcnow)
    emailed_at  = Column(DateTime, nullable=True)         # null = not delivered to the inbox (yet)
