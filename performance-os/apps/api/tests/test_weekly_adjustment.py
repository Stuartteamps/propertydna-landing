"""Audit finding #7: weekly nutrition adjustment persists and survives dashboard recompute."""


def _onboard(c):
    c.post("/api/profile/onboarding", json={
        "name": "Adj", "sex": "male", "height_cm": 185, "weight_kg": 86,
        "training_experience": "advanced",
        "goals": [{"objective": "fat_loss", "priority": 1}], "consent_accepted": True,
    })


def test_weekly_adjustment_persists_through_dashboard(auth_client):
    _onboard(auth_client)
    auth_client.post("/api/integrations/apple_health/connect")
    auth_client.post("/api/integrations/apple_health/sync", json={"days": 14})

    adj = auth_client.post("/api/nutrition/weekly-adjustment?on=2026-07-20").json()
    assert "adjustment_kcal" in adj and "reasons" in adj and adj["reasons"]
    baseline = adj["baseline_calories"]
    delta = adj["adjustment_kcal"]
    assert abs(delta) <= 150  # engine bounds the weekly change

    # The dashboard must reflect baseline+delta and NOT clobber it on recompute.
    d1 = auth_client.get("/api/dashboard/today?on=2026-07-20").json()
    assert d1["nutrition"]["targets"]["adjustment_kcal"] == delta
    assert d1["nutrition"]["targets"]["calories"] == baseline + delta
    # Call again — still preserved.
    d2 = auth_client.get("/api/dashboard/today?on=2026-07-20").json()
    assert d2["nutrition"]["targets"]["calories"] == baseline + delta
    assert d2["nutrition"]["targets"]["adjustment_reasons"]
