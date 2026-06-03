from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session

from config_loader import get
from database import get_db

# JWT Configuration (with hot-reload support)
SECRET_KEY = get('jwt.secret_key', 'YOUR_SUPER_SECRET_KEY')
ALGORITHM = get('jwt.algorithm', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = get('jwt.access_token_expire_minutes', 30)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    # Get latest SECRET_KEY and ALGORITHM from config (supports hot-reload)
    current_secret = get('jwt.secret_key', SECRET_KEY)
    current_algo = get('jwt.algorithm', ALGORITHM)
    encoded_jwt = jwt.encode(to_encode, current_secret, algorithm=current_algo)
    return encoded_jwt


async def get_current_admin(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from models import AdminUser

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        # Get latest SECRET_KEY and ALGORITHM from config (supports hot-reload)
        current_secret = get('jwt.secret_key', SECRET_KEY)
        current_algo = get('jwt.algorithm', ALGORITHM)
        payload = jwt.decode(token, current_secret, algorithms=[current_algo])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(AdminUser).filter(AdminUser.username == username).first()
    if user is None:
        raise credentials_exception
    return user


async def get_optional_admin(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from models import AdminUser

    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username:
            user = db.query(AdminUser).filter(AdminUser.username == username).first()
            return user
    except:
        pass
    return None


def check_permission(user: 'AdminUser', required_perm: str):
    if not user: # If user is None (from get_optional_admin), we allow AI for now since requested
        if required_perm == "ai":
            return
        raise HTTPException(status_code=401, detail="Authentication required")

    if not user.group:
        raise HTTPException(status_code=403, detail="User belongs to no group")

    if user.group.name == "SuperAdmin":
        return

    perms = user.group.permissions.split(',') if user.group.permissions else []
    if "all" in perms:
        return

    if required_perm not in perms:
        raise HTTPException(status_code=403, detail=f"Permission denied: requires {required_perm}")


def verify_token(token: str, db: Session, required_permission: str = None):
    from models import TokenRecord

    record = db.query(TokenRecord).filter(TokenRecord.token == token).first()
    if not record:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not record.is_active:
        raise HTTPException(status_code=403, detail="Token is inactive")
    if record.expires_at and record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="Token expired")
    if required_permission and required_permission not in record.permissions.split(','):
        raise HTTPException(status_code=403, detail="Permission denied")
    return record
