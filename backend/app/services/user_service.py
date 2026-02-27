from sqlalchemy.orm import Session
from typing import Optional, Tuple
from ..repositories.user_repo import UserRepo

class UserService:
    def __init__(self, repo: UserRepo):
        self.repo = repo
    def login(self, db: Session, username: str, password: str) -> Optional[Tuple[str, str]]:
        print(f"UserService.login: checking user {username}")
        u = self.repo.get_by_username(db, username)
        if not u:
            print(f"UserService.login: user {username} not found")
            return None
        
        if u.password_hash == password:
            print(f"UserService.login: password match for {username}")
            return f"{username}:token", u.role
        
        print(f"UserService.login: password mismatch for {username}")
        return None
