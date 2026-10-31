import os
import base64
from pydantic_settings import BaseSettings, SettingsConfigDict

# Valid 32-byte base64-encoded Fernet default key (44 chars)
DEFAULT_FERNET_KEY = base64.urlsafe_b64encode(b"sih2026_distress_monitoring_key!").decode()

class Settings(BaseSettings):
    PROJECT_NAME: str = "SIH 2026 PS 26094 Distress & Legal Support Engine"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-for-sih-2026-distress-engine-change-in-prod")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Environment
    ENV: str = os.getenv("ENV", "dev")

    # Database — uses PostgreSQL in Docker, SQLite fallback for plain local dev
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./sql_app.db"
    )

    # Redis URL — used by APScheduler background worker
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # PII Encryption Key (AES-256 Fernet base64 key, 44 chars)
    FERNET_KEY: str = os.getenv("FERNET_KEY", DEFAULT_FERNET_KEY)

    # Quick-Exit Redirect Target URL
    QUICK_EXIT_REDIRECT_URL: str = "https://weather.com"

    # Twilio / Telephony Gateway Credentials
    TWILIO_ACCOUNT_SID: str | None = os.getenv("TWILIO_ACCOUNT_SID", None)
    TWILIO_AUTH_TOKEN: str | None = os.getenv("TWILIO_AUTH_TOKEN", None)
    TWILIO_PHONE_NUMBER: str | None = os.getenv("TWILIO_PHONE_NUMBER", None)
    TWILIO_MOCK_MODE: bool = os.getenv("TWILIO_MOCK_MODE", "true").lower() == "true"

    # Perception scoring service (Sohon, services/scoring, port 8100)
    SCORING_URL: str = os.getenv("SCORING_URL", "http://localhost:8100")
    SCORING_TIMEOUT_SECONDS: float = float(os.getenv("SCORING_TIMEOUT_SECONDS", "10"))

    # Background worker interval (in minutes)
    CHECKIN_WORKER_INTERVAL_MINUTES: int = int(os.getenv("CHECKIN_WORKER_INTERVAL_MINUTES", "60"))

    # Groq API key fallback for local AI responses when VM is offline (set via env var GROQ_API_KEY)
    GROQ_API_KEY: str | None = os.getenv("GROQ_API_KEY", None)

    # OpenRouter API key and model for LLM inference (Sahayak, CaseWriter, trigger extraction)
    OPENROUTER_API_KEY: str | None = os.getenv("OPENROUTER_API_KEY", None)
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "google/gemma-4-26b-a4b-it:free")

    # Azure VM Orchestrator & Microservice URLs
    ORCHESTRATOR_URL: str = os.getenv("ORCHESTRATOR_URL", "http://localhost:8500")
    ORCHESTRATOR_API_KEY: str = os.getenv("ORCHESTRATOR_API_KEY", "vk_dev")
    SCORING_URL: str = os.getenv("SCORING_URL", "http://scoring:8100")
    RISK_ENGINE_URL: str = os.getenv("RISK_ENGINE_URL", "http://localhost:8200")
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8400")

    # Supabase credentials (optional for PostgreSQL / Supabase Auth)
    SUPABASE_URL: str | None = os.getenv("SUPABASE_URL", None)
    SUPABASE_KEY: str | None = os.getenv("SUPABASE_KEY", None)

    # CORS Origins (Explicit list for allow_credentials=True compatibility)
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8081"
    ]

    model_config = SettingsConfigDict(case_sensitive=True, extra="ignore", env_file=".env")

settings = Settings()
