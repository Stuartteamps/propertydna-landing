"""Audit finding #8: full micronutrients flow photo -> save -> persist -> daily totals."""
import io

from sqlmodel import Session, select

from app.db.base import engine
from app.models import NutrientValue


def _png():
    return b"\x89PNG\r\n\x1a\n" + b"0" * 64


def test_micronutrients_persisted_and_summed(auth_client):
    files = {"file": ("m.png", io.BytesIO(_png()), "image/png")}
    analysis = auth_client.post("/api/meals/analyze", files=files,
                                data={"meal_type": "lunch"}).json()
    # The mock now emits per-item micros.
    assert any(it["sodium_mg"] > 0 for it in analysis["items"])
    assert any(it["potassium_mg"] > 0 for it in analysis["items"])

    save = auth_client.post("/api/meals", json={
        "name": analysis["meal_name"], "meal_type": "lunch",
        "eaten_at": "2026-07-20T12:00:00", "items": analysis["items"],
    })
    assert save.status_code == 201
    totals = save.json()["totals_today"]
    assert totals["sodium_mg"] > 0 and totals["potassium_mg"] > 0
    assert totals["calcium_mg"] > 0

    # Persisted at the row level, not just returned.
    with Session(engine) as s:
        nvs = s.exec(select(NutrientValue)).all()
    assert any(nv.sodium_mg > 0 for nv in nvs)
    assert any(nv.magnesium_mg > 0 for nv in nvs)


def test_schema_accepts_micros_directly():
    from app.schemas.food import FoodItem
    it = FoodItem(name="x", estimated_quantity=100, calories=200, sodium_mg=300, iron_mg=2)
    assert it.sodium_mg == 300 and it.iron_mg == 2
