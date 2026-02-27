import os
from dotenv import load_dotenv

load_dotenv(override=True)

ARK_API_KEY = os.getenv("ARK_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///app.db")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
WS_ALLOWED_ORIGINS = os.getenv("WS_ALLOWED_ORIGINS", "*").split(",")
