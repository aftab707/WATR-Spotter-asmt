"""Unit tests for pure risk classification engine (Section 6 test matrix)."""

from dataclasses import FrozenInstanceError

import pytest

from planner.logic.risk import (
    RiskLevel,
    RiskResult,
    classify_checkpoint,
    classify_rain,
    classify_snow,
    classify_wind,
)


# ---------------------------------------------------------------------------
# Wind Matrix (Half-open bands: [0, 25), [25, 35), [35, 45), [45, 55), [55, inf))
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("wind_mph", "expected_level"),
    [
        (0.0, RiskLevel.LOW),
        (24.9, RiskLevel.LOW),
        (25.0, RiskLevel.MODERATE),
        (34.9, RiskLevel.MODERATE),
        (35.0, RiskLevel.HIGH),
        (44.9, RiskLevel.HIGH),
        (45.0, RiskLevel.SEVERE),
        (54.9, RiskLevel.SEVERE),
        (55.0, RiskLevel.NO_TRAVEL),
        (65.0, RiskLevel.NO_TRAVEL),
    ],
)
def test_classify_wind_boundaries(wind_mph: float, expected_level: RiskLevel):
    """Test wind speed boundary thresholds."""
    assert classify_wind(wind_mph) == expected_level


# ---------------------------------------------------------------------------
# Rain Matrix (Upper-inclusive bands: <0.10, [0.10, 0.25], (0.25, 0.50], (0.50, 1.00], >1.00)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("rain_in_hr", "expected_level"),
    [
        (0.0, RiskLevel.LOW),
        (0.09, RiskLevel.LOW),
        (0.10, RiskLevel.MODERATE),
        (0.25, RiskLevel.MODERATE),
        (0.26, RiskLevel.HIGH),
        (0.50, RiskLevel.HIGH),
        (0.51, RiskLevel.SEVERE),
        (1.00, RiskLevel.SEVERE),
        (1.01, RiskLevel.NO_TRAVEL),
        (2.50, RiskLevel.NO_TRAVEL),
    ],
)
def test_classify_rain_boundaries(rain_in_hr: float, expected_level: RiskLevel):
    """Test rain precipitation boundary thresholds."""
    assert classify_rain(rain_in_hr) == expected_level


# ---------------------------------------------------------------------------
# Snow Matrix (Upper-inclusive bands: <0.5, [0.5, 1.0], (1.0, 2.0], (2.0, 3.0], >3.0)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("snow_in_hr", "expected_level"),
    [
        (0.0, RiskLevel.LOW),
        (0.49, RiskLevel.LOW),
        (0.50, RiskLevel.MODERATE),
        (1.00, RiskLevel.MODERATE),
        (1.10, RiskLevel.HIGH),
        (2.00, RiskLevel.HIGH),
        (2.10, RiskLevel.SEVERE),
        (3.00, RiskLevel.SEVERE),
        (3.10, RiskLevel.NO_TRAVEL),
        (5.00, RiskLevel.NO_TRAVEL),
    ],
)
def test_classify_snow_boundaries(snow_in_hr: float, expected_level: RiskLevel):
    """Test snowfall boundary thresholds."""
    assert classify_snow(snow_in_hr) == expected_level


# ---------------------------------------------------------------------------
# Load Rules & Strict Inequality Tests
# ---------------------------------------------------------------------------
def test_wind_50_with_30000_lb_stays_severe():
    """Wind 50 mph (severe) with exactly 30,000 lb does NOT trigger load rule (> 30,000 required)."""
    res = classify_checkpoint(wind_mph=50.0, rain_in_hr=0.0, snow_in_hr=0.0, load_lb=30000)
    assert res.level == RiskLevel.SEVERE
    assert res.drivers == ["wind"]
    assert res.load_rule_applied is False
    assert res.score == 4
    assert res.label == "SEVERE"


def test_wind_50_with_30001_lb_elevates_to_no_travel():
    """Wind 50 mph with 30,001 lb triggers load rule elevating SEVERE -> NO_TRAVEL."""
    res = classify_checkpoint(wind_mph=50.0, rain_in_hr=0.0, snow_in_hr=0.0, load_lb=30001)
    assert res.level == RiskLevel.NO_TRAVEL
    assert res.drivers == ["wind"]
    assert res.load_rule_applied is True
    assert res.score == 5
    assert res.label == "NO_TRAVEL"


def test_wind_40_with_40000_lb_stays_high():
    """Wind 40 mph (high) with exactly 40,000 lb does NOT trigger load rule (> 40,000 required)."""
    res = classify_checkpoint(wind_mph=40.0, rain_in_hr=0.0, snow_in_hr=0.0, load_lb=40000)
    assert res.level == RiskLevel.HIGH
    assert res.drivers == ["wind"]
    assert res.load_rule_applied is False
    assert res.score == 3
    assert res.label == "HIGH"


def test_wind_40_with_40001_lb_elevates_to_severe():
    """Wind 40 mph with 40,001 lb triggers load rule elevating HIGH -> SEVERE."""
    res = classify_checkpoint(wind_mph=40.0, rain_in_hr=0.0, snow_in_hr=0.0, load_lb=40001)
    assert res.level == RiskLevel.SEVERE
    assert res.drivers == ["wind"]
    assert res.load_rule_applied is True
    assert res.score == 4
    assert res.label == "SEVERE"


def test_wind_60_with_light_load_is_no_travel():
    """Wind >= 55 mph is NO_TRAVEL for any load (e.g. 1,000 lb), base weather drives it."""
    res = classify_checkpoint(wind_mph=60.0, rain_in_hr=0.0, snow_in_hr=0.0, load_lb=1000)
    assert res.level == RiskLevel.NO_TRAVEL
    assert res.drivers == ["wind"]
    assert res.load_rule_applied is False


def test_load_rule_never_lowers_when_rain_is_severe():
    """Wind 40 mph + rain 0.60 in/hr (severe) + load 41,000 lb stays SEVERE with rain driver."""
    res = classify_checkpoint(wind_mph=40.0, rain_in_hr=0.60, snow_in_hr=0.0, load_lb=41000)
    assert res.level == RiskLevel.SEVERE
    assert res.drivers == ["rain"]
    assert res.load_rule_applied is False


def test_load_rule_never_lowers_when_rain_is_no_travel():
    """Rain 1.20 in/hr (no travel) + wind 40 mph + load 41,000 lb stays NO_TRAVEL with rain driver."""
    res = classify_checkpoint(wind_mph=40.0, rain_in_hr=1.20, snow_in_hr=0.0, load_lb=41000)
    assert res.level == RiskLevel.NO_TRAVEL
    assert res.drivers == ["rain"]
    assert res.load_rule_applied is False


# ---------------------------------------------------------------------------
# Combined Drivers & Max Level Selection Tests
# ---------------------------------------------------------------------------
def test_highest_of_three_wins_snow_driver():
    """Snow produces the highest risk level; drivers contains snow."""
    res = classify_checkpoint(wind_mph=15.0, rain_in_hr=0.15, snow_in_hr=2.5, load_lb=25000)
    assert res.level == RiskLevel.SEVERE
    assert res.drivers == ["snow"]
    assert res.load_rule_applied is False


def test_multiple_drivers_tie_wind_and_rain():
    """Wind 36 mph (HIGH) and rain 0.30 in/hr (HIGH) tie; drivers contains both."""
    res = classify_checkpoint(wind_mph=36.0, rain_in_hr=0.30, snow_in_hr=0.0, load_lb=20000)
    assert res.level == RiskLevel.HIGH
    assert res.drivers == ["wind", "rain"]
    assert res.load_rule_applied is False


def test_all_three_drivers_tie_moderate():
    """All three conditions produce MODERATE; drivers contains wind, rain, snow."""
    res = classify_checkpoint(wind_mph=26.0, rain_in_hr=0.20, snow_in_hr=0.8, load_lb=20000)
    assert res.level == RiskLevel.MODERATE
    assert res.drivers == ["wind", "rain", "snow"]
    assert res.load_rule_applied is False


def test_calm_conditions_produce_low():
    """Calm weather produces LOW with score 1."""
    res = classify_checkpoint(wind_mph=5.0, rain_in_hr=0.0, snow_in_hr=0.0, load_lb=45000)
    assert res.level == RiskLevel.LOW
    assert res.drivers == ["wind", "rain", "snow"]
    assert res.load_rule_applied is False
    assert res.score == 1
    assert res.label == "LOW"


def test_risk_result_immutability():
    """RiskResult is a frozen dataclass preventing accidental mutation."""
    res = RiskResult(level=RiskLevel.LOW, drivers=["wind"], load_rule_applied=False)
    with pytest.raises(FrozenInstanceError):
        res.level = RiskLevel.HIGH  # type: ignore
