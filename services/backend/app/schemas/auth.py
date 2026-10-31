from pydantic import BaseModel
from typing import Optional

class SignupRequest(BaseModel):
    email: str
    password: str
    role: str  # "victim", "counselor", "admin"
    # Optional profile fields
    name: Optional[str] = None
    contact: Optional[str] = None
    vulnerability_category: Optional[str] = "SC/ST_PoA_Sec3"
    preferred_language: Optional[str] = "hi"
    # Counselor-specific
    specialization: Optional[str] = None
    organization: Optional[str] = None
    # Admin-specific
    department: Optional[str] = None
    access_level: Optional[str] = "standard"

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str

class UserProfileResponse(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    # Optional nested profile
    victim_id: Optional[str] = None
    counselor_id: Optional[str] = None
    admin_id: Optional[str] = None

    class Config:
        from_attributes = True
