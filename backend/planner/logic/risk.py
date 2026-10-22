"""Pure Risk Engine for Weather-Aware Truck Routing.

Implements checkpoint risk classification and gross load weight hazard rules.
Per Sections 3 & 6 of PROJECT_SPEC.md:
- Pure functions (no network, no database, zero side-effects).
- Strict threshold boundaries:
    * Wind uses half-open bands [floor, ceil).
    * Rain & Snow use upper-inclusive bands (floor, ceil].
- Load rules can only RAISE risk, never lower it.
- Load weight comparisons are strict (> 30,000 lb, > 40,000 lb).
"""

from dataclasses import dataclass
from enum import IntEnum

# ---------------------------------------------------------------------------
# Named Constants — Wind Thresholds (mph) [half-open bands: floor <= v < ceil)
# ---------------------------------------------------------------------------
WIND_MODERATE_MPH = 25.0
WIND_HIGH_MPH = 35.0
WIND_SEVERE_MPH = 45.0
WIND_NO_TRAVEL_MPH = 55.0

# ---------------------------------------------------------------------------
# Named Constants — Rain Thresholds (in/hr) [upper-inclusive: floor < v <= ceil]
# Floor for Moderate is 0.10 (< 0.10 is Low)
# ---------------------------------------------------------------------------
RAIN_LOW_FLOOR_IN_HR = 0.10
RAIN_MODERATE_CEIL_IN_HR = 0.25
RAIN_HIGH_CEIL_IN_HR = 0.50
RAIN_SEVERE_CEIL_IN_HR = 1.00

# ---------------------------------------------------------------------------
# Named Constants — Snow Thresholds (in/hr) [upper-inclusive: floor < v <= ceil]
# Floor for Moderate is 0.5 (< 0.5 is Low)
# ---------------------------------------------------------------------------
SNOW_LOW_FLOOR_IN_HR = 0.5
SNOW_MODERATE_CEIL_IN_HR = 1.0
SNOW_HIGH_CEIL_IN_HR = 2.0
SNOW_SEVERE_CEIL_IN_HR = 3.0

# ---------------------------------------------------------------------------
# Named Constants — Gross Load Weight Thresholds (lb)
# Strict inequalities: load must be strictly greater than threshold (> lb)
# ---------------------------------------------------------------------------
LOAD_THRESHOLD_SEVERE_WIND_LB = 30000
LOAD_THRESHOLD_HIGH_WIND_LB = 40000


class RiskLevel(IntEnum):
    """Integer-valued risk levels for deterministic arithmetic and comparison.

    Scores: LOW=1, MODERATE=2, HIGH=3, SEVERE=4, NO_TRAVEL=5.
    """

    LOW = 1
    MODERATE = 2
    HIGH = 3
    SEVERE = 4
    NO_TRAVEL = 5


@dataclass(frozen=True)
class RiskResult:
    """Immutable classification result for a checkpoint.

    Attributes:
        level: RiskLevel enum value (1 to 5).
        drivers: Condition names ('wind', 'rain', 'snow') that produced the final level.
        load_rule_applied: True if a truck load rule elevated the risk above base weather.
    """

    level: RiskLevel
    drivers: list[str]
    load_rule_applied: bool

    @property
    def score(self) -> int:
        """Integer score 1 to 5."""
        return int(self.level)

    @property
    def label(self) -> str:
        """String representation: 'LOW', 'MODERATE', 'HIGH', 'SEVERE', 'NO_TRAVEL'."""
        return self.level.name


def classify_wind(wind_mph: float) -> RiskLevel:
    """Classify wind risk using half-open bands.

    Bands:
        [0, 25)   -> LOW
        [25, 35)  -> MODERATE
        [35, 45)  -> HIGH
        [45, 55)  -> SEVERE
        [55, inf) -> NO_TRAVEL
    """
    if wind_mph >= WIND_NO_TRAVEL_MPH:
        return RiskLevel.NO_TRAVEL
    if wind_mph >= WIND_SEVERE_MPH:
        return RiskLevel.SEVERE
    if wind_mph >= WIND_HIGH_MPH:
        return RiskLevel.HIGH
    if wind_mph >= WIND_MODERATE_MPH:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def classify_rain(rain_in_hr: float) -> RiskLevel:
    """Classify rain precipitation risk using upper-inclusive bands.

    Bands:
        < 0.10         -> LOW
        [0.10, 0.25]   -> MODERATE
        (0.25, 0.50]   -> HIGH
        (0.50, 1.00]   -> SEVERE
        > 1.00         -> NO_TRAVEL
    """
    if rain_in_hr > RAIN_SEVERE_CEIL_IN_HR:
        return RiskLevel.NO_TRAVEL
    if rain_in_hr > RAIN_HIGH_CEIL_IN_HR:
        return RiskLevel.SEVERE
    if rain_in_hr > RAIN_MODERATE_CEIL_IN_HR:
        return RiskLevel.HIGH
    if rain_in_hr >= RAIN_LOW_FLOOR_IN_HR:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def classify_snow(snow_in_hr: float) -> RiskLevel:
    """Classify snowfall risk using upper-inclusive bands.

    Bands:
        < 0.5        -> LOW
        [0.5, 1.0]   -> MODERATE
        (1.0, 2.0]   -> HIGH
        (2.0, 3.0]   -> SEVERE
        > 3.0        -> NO_TRAVEL
    """
    if snow_in_hr > SNOW_SEVERE_CEIL_IN_HR:
        return RiskLevel.NO_TRAVEL
    if snow_in_hr > SNOW_HIGH_CEIL_IN_HR:
        return RiskLevel.SEVERE
    if snow_in_hr > SNOW_MODERATE_CEIL_IN_HR:
        return RiskLevel.HIGH
    if snow_in_hr >= SNOW_LOW_FLOOR_IN_HR:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def classify_checkpoint(
    wind_mph: float,
    rain_in_hr: float,
    snow_in_hr: float,
    load_lb: int,
) -> RiskResult:
    """Classify overall checkpoint risk combining weather conditions and load rules.

    Evaluation steps:
    1. Determine individual risk levels for sustained wind, rain, and snow.
    2. Identify base risk = max(wind, rain, snow) and track weather driver(s).
    3. Apply load-specific hazard rules:
        - wind in [45, 55) AND load > 30,000 lb -> elevates to NO_TRAVEL
        - wind in [35, 45) AND load > 40,000 lb -> elevates to SEVERE
    4. Enforce invariant: load rules can only RAISE risk, never lower it.

    Args:
        wind_mph: Sustained 10m wind speed in mph.
        rain_in_hr: Rain + showers precipitation in inches/hr.
        snow_in_hr: Snowfall precipitation in inches/hr.
        load_lb: Truck gross cargo load weight in pounds.

    Returns:
        RiskResult containing level, active drivers list, and load_rule_applied flag.
    """
    wind_lvl = classify_wind(wind_mph)
    rain_lvl = classify_rain(rain_in_hr)
    snow_lvl = classify_snow(snow_in_hr)

    # Base weather risk is the highest level among the three conditions
    base_level = max(wind_lvl, rain_lvl, snow_lvl)

    # Determine which weather condition(s) produced this base maximum
    drivers = []
    if wind_lvl == base_level:
        drivers.append("wind")
    if rain_lvl == base_level:
        drivers.append("rain")
    if snow_lvl == base_level:
        drivers.append("snow")

    # Evaluate load rules
    load_elevated_level = None
    if (
        WIND_SEVERE_MPH <= wind_mph < WIND_NO_TRAVEL_MPH
        and load_lb > LOAD_THRESHOLD_SEVERE_WIND_LB
    ):
        load_elevated_level = RiskLevel.NO_TRAVEL
    elif (
        WIND_HIGH_MPH <= wind_mph < WIND_SEVERE_MPH
        and load_lb > LOAD_THRESHOLD_HIGH_WIND_LB
    ):
        load_elevated_level = RiskLevel.SEVERE

    # Load rules can only raise risk, never lower it
    if load_elevated_level is not None and load_elevated_level > base_level:
        return RiskResult(
            level=load_elevated_level,
            drivers=["wind"],
            load_rule_applied=True,
        )

    return RiskResult(
        level=base_level,
        drivers=drivers,
        load_rule_applied=False,
    )
