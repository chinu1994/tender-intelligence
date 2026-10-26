from datetime import datetime, timedelta, timezone
import hashlib
import secrets

import jwt
from fastapi import HTTPException, status
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.config import settings


def _build_password_hash() -> PasswordHash:
    # Argon2id with library defaults unless explicitly tuned (tests lower the
    # cost to keep the suite fast; never lower it in production).
    if settings.ARGON2_TIME_COST or settings.ARGON2_MEMORY_COST:
        kwargs = {}
        if settings.ARGON2_TIME_COST:
            kwargs["time_cost"] = settings.ARGON2_TIME_COST
        if settings.ARGON2_MEMORY_COST:
            kwargs["memory_cost"] = settings.ARGON2_MEMORY_COST
        return PasswordHash((Argon2Hasher(**kwargs),))
    return PasswordHash.recommended()


password_hash = _build_password_hash()

ACCESS_TOKEN_TYPE = "access"


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return password_hash.verify(password, hashed_password)
    except Exception:  # malformed hash in DB -> treat as mismatch
        return False


def _signing_key() -> str:
    if len(settings.JWT_SECRET) < 32:
        # Never sign tokens with an empty/weak secret.
        raise RuntimeError("JWT_SECRET is not configured (minimum 32 characters).")
    return settings.JWT_SECRET


def create_access_token(user_id: str, tenant_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "role": role,
        "type": ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, _signing_key(), algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            _signing_key(),
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    if payload.get("type", ACCESS_TOKEN_TYPE) != ACCESS_TOKEN_TYPE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )
    return payload


def create_refresh_token() -> str:
    return secrets.token_urlsafe(64)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_refresh_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)


PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = 30


def create_password_reset_token() -> str:
    return secrets.token_urlsafe(48)


def hash_password_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_password_reset_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(
        minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    )
