from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.engine.url import URL
from sqlalchemy.pool import NullPool
import os

POSTGRES_USER     = os.getenv("POSTGRES_USER",     "mockmate")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "password")
POSTGRES_SERVER   = os.getenv("POSTGRES_SERVER",   "localhost")
POSTGRES_PORT     = os.getenv("POSTGRES_PORT",     "5432")
POSTGRES_DB       = os.getenv("POSTGRES_DB",       "mockmate_db")

IS_PRODUCTION = POSTGRES_SERVER != "localhost"

# Use URL.create to safely encode passwords containing special chars (e.g. @)
query_params = {"sslmode": "require"} if IS_PRODUCTION else {}

SQLALCHEMY_DATABASE_URL = URL.create(
    drivername="postgresql+psycopg2",  # SQLAlchemy 2.1 defaults bare "postgresql" to psycopg v3, which isn't installed
    username=POSTGRES_USER,
    password=POSTGRES_PASSWORD,
    host=POSTGRES_SERVER,
    port=int(POSTGRES_PORT),
    database=POSTGRES_DB,
    query=query_params,
)

# In production we use Supabase's PgBouncer (transaction mode).
# NullPool disables SQLAlchemy's own connection pool so PgBouncer can manage
# connections exclusively — this is the officially recommended approach.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    poolclass=NullPool if IS_PRODUCTION else None,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def create_tables():
    """create_all() never alters existing tables, so new nullable model columns are added here.
    shortcut: add-only (no type changes, drops or NOT NULL columns); move to Alembic when those are needed."""
    from sqlalchemy import inspect, text
    Base.metadata.create_all(bind=engine)
    insp = inspect(engine)
    with engine.begin() as conn:
        for t in Base.metadata.sorted_tables:
            have = {c["name"] for c in insp.get_columns(t.name)}
            for c in t.columns:
                if c.name not in have and c.nullable:
                    conn.execute(text(f'ALTER TABLE "{t.name}" ADD COLUMN "{c.name}" {c.type.compile(engine.dialect)}'))
                    print(f"[DB] added missing column {t.name}.{c.name}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
