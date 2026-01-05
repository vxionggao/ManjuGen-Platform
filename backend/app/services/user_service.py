from sqlalchemy.orm import Session
from typing import Optional, Tuple
from ..repositories.user_repo import UserRepo

class UserService:
    def __init__(self, repo: UserRepo):
        self.repo = repo
    def login(self, db: Session, username: str, password: str) -> Optional[Tuple[str, str]]:
        u = self.repo.get_by_username(db, username)
        if u and u.password_hash == password:
            return f"{username}:token", u.role
        return None
