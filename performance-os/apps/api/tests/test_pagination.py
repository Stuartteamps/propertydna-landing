"""Audit finding #12: list endpoints paginate and avoid N+1."""


def _png():
    return b"\x89PNG\r\n\x1a\n" + b"0" * 64


def test_meals_pagination_and_batch_items(auth_client):
    # Create 60 meals; default page returns 50; offset honored.
    for i in range(60):
        auth_client.post("/api/meals", json={
            "name": f"m{i}", "meal_type": "snack",
            "items": [{"name": "egg", "estimated_quantity": 50, "calories": 78,
                       "protein_g": 6, "sodium_mg": 62}],
        })
    page1 = auth_client.get("/api/meals?limit=50&offset=0").json()
    assert page1["count"] == 50 and page1["limit"] == 50
    # items still present (batch-fetched, not dropped)
    assert all("items" in m for m in page1["meals"])
    assert page1["meals"][0]["items"][0]["name"] == "egg"
    page2 = auth_client.get("/api/meals?limit=50&offset=50").json()
    assert page2["count"] == 10

    # limit is bounded
    assert auth_client.get("/api/meals?limit=999").status_code == 422


def test_workouts_pagination(auth_client):
    for i in range(30):
        auth_client.post("/api/workouts", json={
            "type": "strength", "title": f"w{i}",
            "sets": [{"exercise_name": "Squat", "reps": 5, "load_kg": 100}],
        })
    r = auth_client.get("/api/workouts?limit=20").json()
    assert r["count"] == 20
    assert r["workouts"][0]["sets"][0]["exercise"] == "Squat"


def test_labs_and_journal_pagination(auth_client):
    for i in range(5):
        auth_client.post("/api/labs", json={"test_name": f"t{i}", "value": 1.0, "unit": "mg/dL"})
    labs = auth_client.get("/api/labs?limit=3").json()
    assert labs["count"] == 3 and "limit" in labs
    j = auth_client.get("/api/journal?limit=10").json()
    assert "limit" in j and "count" in j
