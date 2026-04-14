from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from uuid import UUID


class QuestionOut(BaseModel):
    id: UUID
    content: str
    category: Optional[str] = None
    difficulty: Optional[int] = None
    order_index: int = 0
    transcript: Optional[str] = None
    score: Optional[float] = None

    class Config:
        from_attributes = True


class InterviewSessionOut(BaseModel):
    id: UUID
    user_id: UUID
    company_name: str
    target_role: Optional[str] = None
    job_description: str
    questions_count: int
    duration_minutes: int
    interviewer_persona: str
    strictness_level: str
    status: str
    overall_score: Optional[float] = None
    feedback_summary: Optional[str] = None
    video_storage_path: Optional[str] = None
    transcript: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    questions: List[QuestionOut] = []

    class Config:
        from_attributes = True


class EvaluationPatch(BaseModel):
    overall_score: Optional[float] = None
    feedback_summary: Optional[str] = None
    status: Optional[str] = None
    transcript: Optional[str] = None
    per_question_data: Optional[List[dict]] = None  # [{question_id, transcript, score, evaluation}]
