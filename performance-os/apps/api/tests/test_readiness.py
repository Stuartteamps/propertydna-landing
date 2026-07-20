from app.engines.readiness import ReadinessInput, compute_readiness


def test_full_data_scores_and_bands_green():
    inp = ReadinessInput(
        sleep_minutes=480, sleep_target_minutes=480, sleep_std_minutes=20,
        hrv_ms=70, hrv_baseline_ms=60, resting_hr=48, resting_hr_baseline=50,
        acute_load=300, chronic_load=350, soreness=1, mood=5, energy=5, illness=False,
    )
    r = compute_readiness(inp)
    assert r.score is not None and r.score >= 70
    assert r.band == "green"
    assert r.data_completeness > 0.9


def test_missing_sleep_data_still_scores_if_enough_present():
    inp = ReadinessInput(
        hrv_ms=55, hrv_baseline_ms=60, resting_hr=52, resting_hr_baseline=50,
        acute_load=400, chronic_load=350, soreness=3,
    )
    r = compute_readiness(inp)
    assert r.score is not None
    assert 0 <= r.score <= 100


def test_insufficient_data_returns_unknown():
    # Only mood present -> below completeness threshold.
    r = compute_readiness(ReadinessInput(mood=4))
    assert r.score is None
    assert r.band == "unknown"
    assert "Not enough data" in r.explanation[0]


def test_low_hrv_explanation_mentions_hrv():
    inp = ReadinessInput(
        sleep_minutes=470, sleep_target_minutes=480, sleep_std_minutes=25,
        hrv_ms=45, hrv_baseline_ms=60, resting_hr=55, resting_hr_baseline=50,
        acute_load=500, chronic_load=350,
    )
    r = compute_readiness(inp)
    # HRV 25% below baseline is the biggest driver and must be surfaced in the explanation.
    assert any("HRV" in e for e in r.explanation)


def test_illness_pushes_score_down():
    base = dict(sleep_minutes=480, sleep_target_minutes=480, sleep_std_minutes=20,
                hrv_ms=60, hrv_baseline_ms=60, resting_hr=50, resting_hr_baseline=50)
    healthy = compute_readiness(ReadinessInput(**base, illness=False))
    sick = compute_readiness(ReadinessInput(**base, illness=True))
    assert sick.score < healthy.score


def test_weights_are_configurable():
    inp = ReadinessInput(sleep_minutes=300, sleep_target_minutes=480, sleep_std_minutes=20,
                         hrv_ms=60, hrv_baseline_ms=60)
    default = compute_readiness(inp)
    heavy_sleep = compute_readiness(inp, weights={"sleep_duration": 0.9})
    assert heavy_sleep.score != default.score
