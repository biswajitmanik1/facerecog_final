import os
import time
import jwt
from fastapi import Request, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not set -- required to sign auth tokens (see backend/.env)")

ALGORITHM = "HS256"
TOKEN_TTL_SECONDS = 8 * 60 * 60  # 8 hours

security = HTTPBearer()

class AuthException(Exception):
    def __init__(self, status_code: int, error: str):
        self.status_code = status_code
        self.error = error

def issue_token(user_id, email, role, department=None):
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "iat": now,
        "exp": now + TOKEN_TTL_SECONDS,
    }
    if department:
        payload["department"] = department
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {
            "id": payload.get("sub"),
            "email": payload.get("email"),
            "role": payload.get("role"),
            "department": payload.get("department")
        }
    except jwt.ExpiredSignatureError:
        raise AuthException(status_code=401, error="Session expired, please sign in again")
    except jwt.InvalidTokenError:
        raise AuthException(status_code=401, error="Invalid authentication token")

class RoleChecker:
    def __init__(self, allowed_roles: list):
        self.allowed_roles = allowed_roles

    def __call__(self, user: dict = Security(get_current_user)):
        if self.allowed_roles and user.get("role") not in self.allowed_roles:
            raise AuthException(status_code=403, error="Unauthorized for this action")
        return user

def require_auth(*allowed_roles):
    """
    Use this as a dependency in FastAPI routes.
    Example:
    @router.get('/some-route')
    def my_route(current_user: dict = Depends(require_auth('admin', 'teacher'))):
        pass
    """
    return RoleChecker(list(allowed_roles))

