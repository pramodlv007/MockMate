from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .deps import limiter
from .database import engine, Base
from .routers import users, interviews, auth
import os

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="MockMate API", version="2.0.0", description="MockMate — AI-powered mock interview platform")

# Rate Limiting (shared limiter from deps.py)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
# In production, restrict this to ONLY your frontend domain
ALLOWED_ORIGINS = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
    "http://127.0.0.1:3000",
    "http://localhost:5173",   # Vite dev server
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,  # Required for cross-origin cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Uploads
if not os.path.exists("uploads"):
    os.makedirs("uploads")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(interviews.router)


@app.get("/")
def read_root():
    return {"message": "Welcome to MockMate API v2.0"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
