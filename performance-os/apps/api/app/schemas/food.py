"""Strict structured schema for AI food analysis. All AI output is validated against this
before it is ever stored (see app/ai/validation.py)."""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

MICRONUTRIENT_FIELDS = [
    "sugar_g", "sodium_mg", "potassium_mg", "calcium_mg", "iron_mg", "magnesium_mg",
    "vitamin_a_ug", "vitamin_c_mg", "vitamin_d_ug", "vitamin_b12_ug", "folate_ug", "cholesterol_mg",
]


class FoodItem(BaseModel):
    name: str
    estimated_quantity: float = Field(ge=0)
    unit: str = "g"
    calories: float = Field(ge=0)
    protein_g: float = Field(ge=0, default=0)
    carbohydrates_g: float = Field(ge=0, default=0)
    fat_g: float = Field(ge=0, default=0)
    fiber_g: float = Field(ge=0, default=0)
    # Full micronutrient set (per item; estimates, default 0 when unknown).
    sugar_g: float = Field(ge=0, default=0)
    sodium_mg: float = Field(ge=0, default=0)
    potassium_mg: float = Field(ge=0, default=0)
    calcium_mg: float = Field(ge=0, default=0)
    iron_mg: float = Field(ge=0, default=0)
    magnesium_mg: float = Field(ge=0, default=0)
    vitamin_a_ug: float = Field(ge=0, default=0)
    vitamin_c_mg: float = Field(ge=0, default=0)
    vitamin_d_ug: float = Field(ge=0, default=0)
    vitamin_b12_ug: float = Field(ge=0, default=0)
    folate_ug: float = Field(ge=0, default=0)
    cholesterol_mg: float = Field(ge=0, default=0)
    confidence: float = 0.5  # clamped to [0,1] in app.ai.validation


class FoodTotals(BaseModel):
    calories: float = Field(ge=0)
    protein_g: float = Field(ge=0, default=0)
    carbohydrates_g: float = Field(ge=0, default=0)
    fat_g: float = Field(ge=0, default=0)
    fiber_g: float = Field(ge=0, default=0)
    sugar_g: float = Field(ge=0, default=0)
    sodium_mg: float = Field(ge=0, default=0)
    potassium_mg: float = Field(ge=0, default=0)
    calcium_mg: float = Field(ge=0, default=0)
    iron_mg: float = Field(ge=0, default=0)
    magnesium_mg: float = Field(ge=0, default=0)
    vitamin_a_ug: float = Field(ge=0, default=0)
    vitamin_c_mg: float = Field(ge=0, default=0)
    vitamin_d_ug: float = Field(ge=0, default=0)
    vitamin_b12_ug: float = Field(ge=0, default=0)
    folate_ug: float = Field(ge=0, default=0)
    cholesterol_mg: float = Field(ge=0, default=0)


class FoodAnalysis(BaseModel):
    """Canonical vision/nutrition result. `is_estimate` is always True — never present as exact."""
    meal_name: str
    meal_type: str = "snack"
    items: list[FoodItem]
    totals: FoodTotals
    assumptions: list[str] = Field(default_factory=list)
    overall_confidence: float = 0.5  # clamped to [0,1] in app.ai.validation
    is_estimate: bool = True

    @field_validator("meal_type")
    @classmethod
    def _valid_meal_type(cls, v: str) -> str:
        allowed = {"breakfast", "lunch", "dinner", "snack"}
        return v if v in allowed else "snack"

    @field_validator("items")
    @classmethod
    def _non_empty(cls, v: list[FoodItem]) -> list[FoodItem]:
        if not v:
            raise ValueError("food analysis must contain at least one item")
        return v
