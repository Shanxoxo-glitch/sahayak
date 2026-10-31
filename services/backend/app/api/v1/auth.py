"""
app/api/v1/auth.py
──────────────────
Authentication endpoints backed by our local Users table + JWT.

Endpoints:
  POST /api/v1/auth/signup  — Register victim / counselor / admin
  POST /api/v1/auth/login   — Login, get JWT + role
  GET  /api/v1/auth/me      — Current user profile
  POST /api/v1/auth/purge   — Covert quick-exit session purge
  GET  /api/v1/auth/purge   — Same, for one-tap button
"""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.victim import Victim
from app.models.counselor import Counselor
from app.models.admin import Admin
from app.models.consent import ConsentRecord
from app.schemas.auth import SignupRequest, LoginRequest, TokenResponse, UserProfileResponse
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from app.services.encryption import encrypt_pii

router = APIRouter(prefix="/auth", tags=["Authentication & Quick-Exit"])


# ── Signup ────────────────────────────────────────────────────────────────────
@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)):
    """
    Register a new user (victim / counselor / admin).
    Creates the base User row, then the role-specific profile row.
    Returns a JWT token immediately — no separate login step needed.
    """
    if payload.role not in ("victim", "counselor", "admin"):
        raise HTTPException(status_code=400, detail="role must be victim, counselor, or admin")

    # Check duplicate email
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Create base user
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.flush()  # Flush to get user.id before creating profile

    # Create role-specific profile
    if payload.role == "victim":
        if not payload.name or not payload.contact:
            raise HTTPException(status_code=422, detail="name and contact are required for victim signup")
        victim = Victim(
            user_id=user.id,
            name_encrypted=encrypt_pii(payload.name),
            contact_encrypted=encrypt_pii(payload.contact),
            email_encrypted=encrypt_pii(payload.email) if payload.email else None,
            vulnerability_category=payload.vulnerability_category or "SC/ST_PoA_Sec3",
            preferred_language=payload.preferred_language or "hi",
        )
        db.add(victim)
        await db.flush()
        # Grant default SMS check-in consent
        consent = ConsentRecord(victim_id=victim.id, scope="SMS_CHECKIN", status="GRANTED")
        db.add(consent)

    elif payload.role == "counselor":
        counselor = Counselor(
            user_id=user.id,
            name=payload.name or "",
            specialization=payload.specialization or "General",
            organization=payload.organization or "",
        )
        db.add(counselor)

    elif payload.role == "admin":
        admin = Admin(
            user_id=user.id,
            department=payload.department or "",
            access_level=payload.access_level or "standard",
        )
        db.add(admin)

    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(access_token=token, role=user.role, user_id=user.id)


# ── Login ─────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with email + password, receive a JWT token."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(access_token=token, role=user.role, user_id=user.id)


# ── /me ───────────────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Returns the authenticated user profile with role-specific IDs."""
    victim_id = counselor_id = admin_id = None

    if current_user.role == "victim":
        v = await db.execute(select(Victim).where(Victim.user_id == current_user.id))
        victim = v.scalar_one_or_none()
        victim_id = victim.id if victim else None

    elif current_user.role == "counselor":
        c = await db.execute(select(Counselor).where(Counselor.user_id == current_user.id))
        counselor = c.scalar_one_or_none()
        counselor_id = counselor.id if counselor else None

    elif current_user.role == "admin":
        a = await db.execute(select(Admin).where(Admin.user_id == current_user.id))
        admin = a.scalar_one_or_none()
        admin_id = admin.id if admin else None

    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        victim_id=victim_id,
        counselor_id=counselor_id,
        admin_id=admin_id,
    )


# ── Session (legacy covert cookie) ───────────────────────────────────────────
@router.post("/session")
async def create_covert_session(response: Response, victim_id: str):
    """
    Creates a covert, pseudo-anonymous session cookie (HttpOnly + Secure).
    Legacy endpoint kept for PWA compatibility.
    """
    session_token = f"covert_sess_{victim_id[:8]}"
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=60 * 60 * 24 * 7,
    )
    return {"status": "success", "session_created": True, "covert_mode": True}


# ── List Victims (Admin / Counsellor view) ───────────────────────────────────
@router.get("/victims")
async def list_all_victims(db: AsyncSession = Depends(get_db)):
    """
    Returns all registered victim accounts with decrypted PII for admin/counsellor dashboards.
    Uses raw SQL to be schema-agnostic (works with old and new DB schemas).
    No auth gate — relies on internal network / front-end role check.
    """
    from sqlalchemy import text as sa_text
    from app.services.encryption import decrypt_pii

    # Determine available columns (schema-agnostic)
    col_check = await db.execute(sa_text("PRAGMA table_info(victims)"))
    col_names = [row[1] for row in col_check.fetchall()]
    has_user_id = "user_id" in col_names

    # Build column list dynamically
    select_cols = "id, name_encrypted, contact_encrypted, email_encrypted, vulnerability_category, preferred_language, created_at"
    if has_user_id:
        select_cols = "id, user_id, " + select_cols.replace("id, ", "", 1)

    result = await db.execute(sa_text(f"SELECT {select_cols} FROM victims ORDER BY created_at DESC"))
    rows = result.fetchall()
    col_keys = result.keys() if hasattr(result, "keys") else col_names

    victims_out = []
    for row in rows:
        row_dict = dict(zip(result.keys(), row)) if hasattr(result, "keys") else {}
        # Fallback mapping if keys() not available
        if not row_dict:
            keys = ["id", "user_id", "name_encrypted", "contact_encrypted", "email_encrypted", "vulnerability_category", "preferred_language", "created_at"] if has_user_id else ["id", "name_encrypted", "contact_encrypted", "email_encrypted", "vulnerability_category", "preferred_language", "created_at"]
            row_dict = dict(zip(keys, row))

        uid = row_dict.get("user_id") or row_dict.get("id")
        name_raw = row_dict.get("name_encrypted")
        email_raw = row_dict.get("email_encrypted")
        phone_raw = row_dict.get("contact_encrypted")
        created = row_dict.get("created_at")

        victims_out.append({
            "id": row_dict.get("id"),
            "user_id": uid,
            "name": decrypt_pii(name_raw) if name_raw else None,
            "email": decrypt_pii(email_raw) if email_raw else None,
            "phone": decrypt_pii(phone_raw) if phone_raw else None,
            "vulnerability_category": row_dict.get("vulnerability_category"),
            "preferred_language": row_dict.get("preferred_language"),
            "registered_at": str(created) if created else None,
            "auth_method": "traditional",
            "share_personal_info": True,
        })
    return victims_out


# ── Quick-Exit Purge ──────────────────────────────────────────────────────────
@router.post("/purge")
@router.get("/purge")
async def quick_exit_purge():
    """
    QUICK-EXIT EMERGENCY ENDPOINT:
    Single-tap trigger that purges all session cookies and redirects to a neutral page.
    """
    response = RedirectResponse(url=settings.QUICK_EXIT_REDIRECT_URL, status_code=status.HTTP_302_FOUND)
    response.delete_cookie("session_token")
    response.delete_cookie("access_token")
    return response
