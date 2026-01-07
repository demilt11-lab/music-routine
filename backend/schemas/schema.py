from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

# Auth
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    is_active: bool

    class Config:
        orm_mode = True

# Song
class SongCreate(BaseModel):
    title: str
    artist: Optional[str] = None
    spotify_id: Optional[str] = None
    url: Optional[str] = None

class SongOut(SongCreate):
    id: int

    class Config:
        orm_mode = True

# Session
class SessionCreate(BaseModel):
    name: str
    notes: Optional[str] = None
    song_ids: List[int] = []

class SessionOut(BaseModel):
    id: int
    name: str
    notes: Optional[str] = None
    created_at: datetime
    songs: List[SongOut] = []

    class Config:
        orm_mode = True
