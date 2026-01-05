from sqlalchemy.orm import Session
from typing import Optional
from ..models.user import User

class UserRepo:
    def get_by_username(self, db: Session, username: str) -> Optional[User]:
        return db.query(User).filter(User.username == username).first()
    def create(self, db: Session, username: str, password_hash: str, role: str) -> User:
        u = User(username=username, password_hash=password_hash, role=role)
        db.add(u)
        db.commit()
        db.refresh(u)
        return u
