from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import crud, schemas, models
from auth_utils import get_current_user, get_db

router = APIRouter(prefix="/sessions", tags=["sessions"])

@router.post("", response_model=schemas.SessionOut)
def create_session(session_in: schemas.SessionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Validate song_ids: return 400 if any song_id doesn't exist
    if session_in.song_ids:
        existing_ids = {s.id for s in db.query(models.Song).filter(models.Song.id.in_(session_in.song_ids)).all()}
        missing = [sid for sid in session_in.song_ids if sid not in existing_ids]
        if missing:
            raise HTTPException(status_code=400, detail=f"Some song_ids not found: {missing}")
    session = crud.create_session(db, current_user, session_in.name, session_in.notes, session_in.song_ids)
    return session

@router.get("", response_model=List[schemas.SessionOut])
def list_sessions(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_sessions_for_user(db, current_user)
