from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.api.deps import audit, db, get_current_user
from app.models import LabResult, User

router = APIRouter(prefix="/labs", tags=["labs"])

# Common panels offered for quick entry (educational grouping only).
PANELS = {
    "CBC": ["WBC", "RBC", "Hemoglobin", "Hematocrit", "Platelets"],
    "CMP": ["Glucose", "BUN", "Creatinine", "Sodium", "Potassium", "ALT", "AST"],
    "Lipid": ["Total Cholesterol", "LDL", "HDL", "Triglycerides", "ApoB", "Lp(a)"],
    "Metabolic": ["A1C", "Fasting Glucose", "Fasting Insulin"],
    "Thyroid": ["TSH", "Free T4", "Free T3"],
    "Hormones": ["Testosterone", "Free Testosterone", "SHBG", "Estradiol"],
    "Vitamins/Minerals": ["Vitamin D", "B12", "Ferritin", "Iron", "Magnesium"],
    "Inflammation": ["hs-CRP"],
}

EDUCATION = (
    "Values shown are what you (or your lab) entered, alongside the lab's own reference range. "
    "Arete does not interpret, diagnose, or recommend medication changes. Discuss any "
    "out-of-range or concerning results with a licensed clinician."
)


class LabIn(BaseModel):
    panel: str | None = None
    test_name: str
    value: float
    unit: str
    reference_low: float | None = None
    reference_high: float | None = None
    flag: str | None = None
    collected_on: dt.date | None = None
    laboratory: str | None = None
    notes: str | None = None
    source_document: str | None = None


@router.get("/panels")
def panels() -> dict:
    return {"panels": PANELS, "education": EDUCATION}


@router.post("", status_code=status.HTTP_201_CREATED)
def add_lab(body: LabIn, user: User = Depends(get_current_user),
            session: Session = Depends(db)) -> dict:
    if not body.unit.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unit is required")
    # Derive a display flag only from the user/lab supplied reference range — never interpret.
    flag = body.flag
    if flag is None and body.reference_low is not None and body.reference_high is not None:
        if body.value < body.reference_low:
            flag = "low"
        elif body.value > body.reference_high:
            flag = "high"
        else:
            flag = "normal"
    row = LabResult(user_id=user.id, **body.model_dump(exclude={"flag"}), flag=flag)
    session.add(row)
    session.commit()
    audit(session, "lab_add", user_id=user.id, resource=body.test_name)  # no value in audit
    return {"id": row.id, "flag": flag, "education": EDUCATION}


@router.get("")
def list_labs(limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0),
              user: User = Depends(get_current_user), session: Session = Depends(db)) -> dict:
    rows = session.exec(
        select(LabResult).where(LabResult.user_id == user.id)
        .order_by(LabResult.collected_on.desc()).limit(limit).offset(offset)
    ).all()
    return {
        "limit": limit, "offset": offset, "count": len(rows),
        "labs": [{
            "id": r.id, "panel": r.panel, "test_name": r.test_name, "value": r.value,
            "unit": r.unit, "reference_low": r.reference_low, "reference_high": r.reference_high,
            "flag": r.flag, "collected_on": r.collected_on.isoformat() if r.collected_on else None,
            "laboratory": r.laboratory,
        } for r in rows],
        "education": EDUCATION,
    }
