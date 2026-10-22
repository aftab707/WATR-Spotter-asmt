/**
 * Risk Engine Constants, Colors, Labels, and Icon Mappings.
 *
 * Per Section 8 UI/UX Quality Bar:
 * - Risk colors must be identical everywhere (chips, markers, strip, heatmap legend).
 * - INVARIANT: Never color-only — always accompanied by text label and icon.
 */

export const RISK_LEVELS = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  SEVERE: 4,
  NO_TRAVEL: 5,
};

export const RISK_CONFIG = {
  1: {
    level: 1,
    key: 'LOW',
    label: 'Low',
    color: '#22c55e', // Green
    contrastText: '#052e16',
    bgColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: '#22c55e',
    iconName: 'CheckCircleOutline',
    description: 'Safe driving conditions. Wind < 25 mph, light rain/snow.',
  },
  2: {
    level: 2,
    key: 'MODERATE',
    label: 'Moderate',
    color: '#eab308', // Yellow
    contrastText: '#422006',
    bgColor: 'rgba(234, 179, 8, 0.12)',
    borderColor: '#eab308',
    iconName: 'WarningAmber',
    description: 'Advisory conditions. Wind 25–34 mph, moderate rain/snow.',
  },
  3: {
    level: 3,
    key: 'HIGH',
    label: 'High',
    color: '#f97316', // Orange
    contrastText: '#431407',
    bgColor: 'rgba(249, 115, 22, 0.12)',
    borderColor: '#f97316',
    iconName: 'Warning',
    description: 'Hazardous conditions. Wind 35–44 mph, heavy rain/snow.',
  },
  4: {
    level: 4,
    key: 'SEVERE',
    label: 'Severe',
    color: '#ef4444', // Red
    contrastText: '#450a0a',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
    iconName: 'ReportProblem',
    description: 'High roll-over risk. Wind 45–54 mph or >40k lb on high wind.',
  },
  5: {
    level: 5,
    key: 'NO_TRAVEL',
    label: 'No Travel',
    color: '#a855f7', // Purple / Dark Red
    contrastText: '#3b0764',
    bgColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: '#a855f7',
    iconName: 'Dangerous',
    description: 'Extreme danger. Wind >= 55 mph or >30k lb on severe wind.',
  },
};

/**
 * Retrieve risk configuration by numeric score (1-5) or string label ('LOW', 'SEVERE').
 *
 * @param {number | string} levelOrKey
 * @returns {typeof RISK_CONFIG[1]}
 */
export function getRiskConfig(levelOrKey) {
  if (typeof levelOrKey === 'number') {
    return RISK_CONFIG[levelOrKey] || RISK_CONFIG[1];
  }
  if (!levelOrKey) {
    return RISK_CONFIG[1];
  }
  const keyUpper = String(levelOrKey).toUpperCase().replace('-', '_');
  const found = Object.values(RISK_CONFIG).find((c) => c.key === keyUpper);
  return found || RISK_CONFIG[1];
}
