from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
import crud, schemas, models
from auth_utils import get_db, get_current_user

router = APIRouter(prefix="/songs", tags=["songs"])

@router.post("", response_model=schemas.SongOut)
def create_song(song_in: schemas.SongCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.create_song(db, song_in)

@router.get("", response_model=List[schemas.SongOut])
def list_songs(db: Session = Depends(get_db)):
    return crud.list_songs(db)
