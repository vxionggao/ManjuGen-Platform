from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from . import settings

url = settings.DATABASE_URL
connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
engine = create_engine(url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
