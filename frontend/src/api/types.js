/**
 * JSDoc Type Definitions for Weather-Aware Truck Routing (WATR) API
 * Matching Section 5 contract in PROJECT_SPEC.md.
 */

/**
 * @typedef {Object} HealthCheckResponse
 * @property {'ok'} status
 */

/**
 * @typedef {Object} GeocodeResult
 * @property {string} label - Formatted place name (e.g., "Chicago, IL, USA")
 * @property {number} lat - Latitude in degrees
 * @property {number} lon - Longitude in degrees
 */

/**
 * @typedef {Object} GeocodeResponse
 * @property {GeocodeResult[]} results
 */

/**
 * @typedef {Object} PlanTripRequest
 * @property {{ label: string, lat: number, lon: number }} origin
 * @property {{ label: string, lat: number, lon: number }} destination
 * @property {string} departure_time - ISO 8601 string
 * @property {number} load_weight_lb - Integer between 1 and 120,000
 * @property {10 | 25 | 50} sampling_interval_miles
 */

/**
 * @typedef {'wind' | 'rain' | 'snow'} RiskDriver
 */

/**
 * @typedef {'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'NO_TRAVEL'} RiskLevelLabel
 */

/**
 * @typedef {1 | 2 | 3 | 4 | 5} RiskLevelScore
 */

/**
 * @typedef {Object} Checkpoint
 * @property {number} index
 * @property {number} mile
 * @property {number} lat
 * @property {number} lon
 * @property {string} eta - ISO 8601 string
 * @property {RiskLevelScore} risk - 1 (Low) to 5 (No Travel)
 * @property {RiskLevelLabel} risk_label
 * @property {number} wind_mph
 * @property {number} rain_in_hr
 * @property {number} snow_in_hr
 * @property {RiskDriver[]} drivers
 * @property {boolean} load_rule_applied
 * @property {number} segment_miles
 */

/**
 * @typedef {Object} RouteSummary
 * @property {number} no_travel_miles
 * @property {number} severe_miles
 * @property {number} high_miles
 * @property {number} moderate_miles
 * @property {number} low_miles
 * @property {number} avg_risk
 * @property {RiskLevelScore} max_risk
 * @property {RiskLevelLabel} max_risk_label
 */

/**
 * @typedef {Object} RouteGeometry
 * @property {'LineString'} type
 * @property {number[][]} coordinates - Array of [lon, lat] pairs
 */

/**
 * @typedef {Object} RouteOption
 * @property {string} id - e.g. "r1", "r2", "r3"
 * @property {string} label - e.g. "Route A"
 * @property {number} rank - 1-based recommendation rank
 * @property {boolean} is_recommended
 * @property {number} distance_miles
 * @property {number} duration_minutes
 * @property {string} arrival_time - ISO 8601 string
 * @property {RouteGeometry} geometry
 * @property {RouteSummary} summary
 * @property {string} recommendation_reason
 * @property {Checkpoint[]} checkpoints
 */

/**
 * @typedef {Object} HeatmapPoint
 * @property {number} lat
 * @property {number} lon
 * @property {string[]} route_ids
 * @property {RiskLevelScore[]} risk - 49 hourly risk scores (0 to 48 hours post departure)
 */

/**
 * @typedef {Object} HeatmapSeries
 * @property {number[]} hours - [0, 1, ..., 48]
 * @property {HeatmapPoint[]} points
 */

/**
 * @typedef {Object} PlanMeta
 * @property {string} generated_at
 * @property {string} departure_time
 * @property {number} load_weight_lb
 * @property {number} sampling_interval_miles
 * @property {string} weather_source
 * @property {string[]} warnings
 */

/**
 * @typedef {Object} PlanTripResponse
 * @property {PlanMeta} meta
 * @property {string} recommended_route_id
 * @property {RouteOption[]} routes
 * @property {HeatmapSeries} heatmap
 */

export {};
