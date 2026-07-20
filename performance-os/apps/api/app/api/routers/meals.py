from __future__ import annotations

import datetime as dt
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.ai.factory import get_nutrition_provider, get_vision_provider
from app.ai.validation import AIValidationError, validate_food_analysis
from app.api.deps import db, get_current_user
from app.core.config import settings
from app.core.timeutil import now_utc
from app.models import (
    AIAnalysisRecord,
    FoodImage,
    Meal,
    MealItem,
    NutrientValue,
    User,
)
from app.schemas.food import FoodAnalysis, FoodItem
from app.services.daily import consumed_totals

router = APIRouter(prefix="/meals", tags=["meals"])

_MACRO_FIELDS = ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g"]


def _store_image(user_id: str, upload: UploadFile) -> tuple[str, bytes]:
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    data = upload.file.read()
    ext = (upload.filename or "jpg").split(".")[-1][:5]
    fname = f"{user_id}_{uuid.uuid4().hex}.{ext}"
    path = Path(settings.UPLOAD_DIR) / fname
    path.write_bytes(data)
    return str(path), data


@router.post("/analyze", response_model=FoodAnalysis)
async def analyze_photo(
    file: UploadFile = File(...),
    meal_type: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    session: Session = Depends(db),
) -> FoodAnalysis:
    """Upload a photo → mock/real vision → validated, editable estimate. Not yet saved."""
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Expected an image")
    path, data = _store_image(user.id, file)
    image = FoodImage(user_id=user.id, path=path, content_type=file.content_type or "image/jpeg")
    session.add(image)
    session.commit()
    session.refresh(image)

    provider = get_vision_provider()
    t0 = time.time()
    try:
        raw = provider.analyze_food_image(data, hint=meal_type)
        analysis = validate_food_analysis(raw)
    except AIValidationError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e)) from e
    session.add(AIAnalysisRecord(
        user_id=user.id, kind="vision", provider=provider.name, request_ref=image.id,
        output_confidence=analysis.overall_confidence, valid=True,
        latency_ms=int((time.time() - t0) * 1000),
    ))
    session.commit()
    # Attach the image id via meal_name suffix is wrong; return through a header-free field:
    analysis.assumptions.append(f"image_id:{image.id}")
    return analysis


class SaveMealIn(BaseModel):
    name: str | None = None
    meal_type: str = "snack"
    source: str = "ai_photo"
    image_id: str | None = None
    overall_confidence: float | None = None
    assumptions: list[str] = []
    eaten_at: dt.datetime | None = None
    items: list[FoodItem]


def _persist_meal(session: Session, user_id: str, body: SaveMealIn) -> Meal:
    meal = Meal(
        user_id=user_id,
        name=body.name,
        meal_type=body.meal_type,
        source=body.source,
        image_id=body.image_id,
        overall_confidence=body.overall_confidence,
        assumptions=[a for a in body.assumptions if not a.startswith("image_id:")],
        eaten_at=body.eaten_at or now_utc(),
    )
    session.add(meal)
    session.commit()
    session.refresh(meal)
    for it in body.items:
        mi = MealItem(
            meal_id=meal.id, name=it.name, estimated_quantity=it.estimated_quantity,
            unit=it.unit, confidence=it.confidence, user_corrected=(body.source == "manual"),
        )
        session.add(mi)
        session.commit()
        session.refresh(mi)
        session.add(NutrientValue(
            meal_item_id=mi.id, calories=it.calories, protein_g=it.protein_g,
            carbs_g=it.carbohydrates_g, fat_g=it.fat_g, fiber_g=it.fiber_g,
        ))
    session.commit()
    return meal


@router.post("", status_code=status.HTTP_201_CREATED)
def save_meal(body: SaveMealIn, user: User = Depends(get_current_user),
              session: Session = Depends(db)) -> dict:
    if not body.items:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A meal needs at least one item")
    meal = _persist_meal(session, user.id, body)
    on = meal.eaten_at.date()
    return {"id": meal.id, "totals_today": consumed_totals(session, user.id, on)}


class TextLogIn(BaseModel):
    text: str
    meal_type: str | None = None


@router.post("/parse-text", response_model=FoodAnalysis)
def parse_text(body: TextLogIn, user: User = Depends(get_current_user),
               session: Session = Depends(db)) -> FoodAnalysis:
    provider = get_nutrition_provider()
    analysis = validate_food_analysis(provider.parse_meal_text(body.text))
    if body.meal_type:
        analysis.meal_type = body.meal_type
    return analysis


@router.get("")
def list_meals(on: dt.date | None = None, user: User = Depends(get_current_user),
               session: Session = Depends(db)) -> dict:
    meals = session.exec(
        select(Meal).where(Meal.user_id == user.id).order_by(Meal.eaten_at.desc())
    ).all()
    out = []
    for m in meals:
        if m.deleted_at is not None:
            continue
        if on and m.eaten_at.date() != on:
            continue
        items = session.exec(select(MealItem).where(MealItem.meal_id == m.id)).all()
        out.append({
            "id": m.id, "name": m.name, "meal_type": m.meal_type,
            "eaten_at": m.eaten_at.isoformat(), "source": m.source,
            "overall_confidence": m.overall_confidence, "is_favorite": m.is_favorite,
            "items": [{"name": i.name, "quantity": i.estimated_quantity, "unit": i.unit,
                       "confidence": i.confidence} for i in items],
        })
    return {"meals": out}


@router.post("/{meal_id}/favorite")
def toggle_favorite(meal_id: str, user: User = Depends(get_current_user),
                    session: Session = Depends(db)) -> dict:
    meal = session.get(Meal, meal_id)
    if not meal or meal.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meal not found")
    meal.is_favorite = not meal.is_favorite
    session.add(meal)
    session.commit()
    return {"id": meal.id, "is_favorite": meal.is_favorite}


@router.post("/{meal_id}/copy", status_code=status.HTTP_201_CREATED)
def copy_meal(meal_id: str, user: User = Depends(get_current_user),
              session: Session = Depends(db)) -> dict:
    src = session.get(Meal, meal_id)
    if not src or src.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meal not found")
    items = session.exec(select(MealItem).where(MealItem.meal_id == src.id)).all()
    body_items = []
    for i in items:
        nv = session.exec(
            select(NutrientValue).where(NutrientValue.meal_item_id == i.id)
        ).first()
        body_items.append(FoodItem(
            name=i.name, estimated_quantity=i.estimated_quantity or 0, unit=i.unit or "g",
            calories=nv.calories if nv else 0, protein_g=nv.protein_g if nv else 0,
            carbohydrates_g=nv.carbs_g if nv else 0, fat_g=nv.fat_g if nv else 0,
            fiber_g=nv.fiber_g if nv else 0, confidence=i.confidence or 0.5,
        ))
    meal = _persist_meal(session, user.id, SaveMealIn(
        name=src.name, meal_type=src.meal_type, source="saved", items=body_items,
    ))
    return {"id": meal.id}


@router.delete("/{meal_id}")
def delete_meal(meal_id: str, user: User = Depends(get_current_user),
                session: Session = Depends(db)) -> dict:
    meal = session.get(Meal, meal_id)
    if not meal or meal.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meal not found")
    meal.deleted_at = now_utc()
    session.add(meal)
    session.commit()
    return {"ok": True}


@router.get("/totals")
def totals(on: dt.date | None = None, user: User = Depends(get_current_user),
           session: Session = Depends(db)) -> dict:
    on = on or dt.date.today()
    return {"date": on.isoformat(), "consumed": consumed_totals(session, user.id, on)}
