import PropTypes from 'prop-types';
import { Box, Tooltip, Stack, Typography } from '@mui/material';
import { RISK_CONFIG } from '../lib/risk';
import { formatTimeOnly, formatMph, formatInHr } from '../lib/formatters';

/**
 * Distance-Proportional Risk Strip component.
 *
 * Per Step 13:
 * - Distance-proportional colored bar per route for at-a-glance comparison.
 * - Segment width = (checkpoint segment_miles / total distance) * 100%.
 * - Colored by checkpoint risk tier using unified design system palette.
 * - Clicking a segment focuses the map camera on that checkpoint.
 */
export default function RiskStrip({
  checkpoints = [],
  totalDistanceMiles,
  height = 10,
  onSelectCheckpoint,
  selectedCheckpointIndex = null,
  showLabels = false,
}) {
  if (!checkpoints || checkpoints.length === 0 || !totalDistanceMiles) {
    return null;
  }

  return (
    <Box sx={{ width: '100%' }}>
      {showLabels && (
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6875rem' }}>
            Mile 0.0 (Start)
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6875rem' }}>
            Mile {totalDistanceMiles.toFixed(1)} (Dest)
          </Typography>
        </Stack>
      )}

      <Box
        role="group"
        aria-label="Route risk exposure strip"
        sx={{
          display: 'flex',
          width: '100%',
          height,
          borderRadius: height > 14 ? 1.5 : 1,
          overflow: 'hidden',
          bgcolor: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        {checkpoints.map((cp) => {
          const segMiles = cp.segment_miles || 0;
          const widthPct = Math.max(0.2, (segMiles / totalDistanceMiles) * 100);
          const cfg = RISK_CONFIG[cp.risk] || RISK_CONFIG[1];
          const isSelected = selectedCheckpointIndex === cp.index;

          const tooltipContent = (
            <Box sx={{ p: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                Mile {cp.mile.toFixed(1)} • {cfg.label} Risk
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                ETA: {formatTimeOnly(cp.eta)} • Segment: {segMiles.toFixed(1)} mi
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                Wind: {formatMph(cp.wind_mph)} • Rain: {formatInHr(cp.rain_in_hr)}
              </Typography>
              {cp.load_rule_applied && (
                <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 700, display: 'block' }}>
                  ⚠️ Heavy Load Rule Applied
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: 'primary.light', display: 'block', mt: 0.5 }}>
                Click to focus on map
              </Typography>
            </Box>
          );

          return (
            <Tooltip key={cp.index} title={tooltipContent} arrow enterDelay={100}>
              <Box
                tabIndex={0}
                role="button"
                aria-label={`Mile ${cp.mile}, ${cfg.label} risk`}
                onClick={() => onSelectCheckpoint && onSelectCheckpoint(cp)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (onSelectCheckpoint) onSelectCheckpoint(cp);
                  }
                }}
                sx={{
                  width: `${widthPct}%`,
                  height: '100%',
                  bgcolor: cfg.color,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s, transform 0.15s',
                  borderRight: '1px solid rgba(0, 0, 0, 0.25)',
                  outline: isSelected ? '2px solid #ffffff' : 'none',
                  zIndex: isSelected ? 2 : 1,
                  '&:hover': {
                    opacity: 0.85,
                    filter: 'brightness(1.15)',
                  },
                  '&:focus-visible': {
                    outline: '2px solid #38bdf8',
                  },
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}

RiskStrip.propTypes = {
  checkpoints: PropTypes.arrayOf(
    PropTypes.shape({
      index: PropTypes.number.isRequired,
      mile: PropTypes.number.isRequired,
      risk: PropTypes.number.isRequired,
      risk_label: PropTypes.string.isRequired,
      segment_miles: PropTypes.number,
      eta: PropTypes.string.isRequired,
      wind_mph: PropTypes.number,
      rain_in_hr: PropTypes.number,
      load_rule_applied: PropTypes.bool,
    })
  ).isRequired,
  totalDistanceMiles: PropTypes.number.isRequired,
  height: PropTypes.number,
  onSelectCheckpoint: PropTypes.func,
  selectedCheckpointIndex: PropTypes.number,
  showLabels: PropTypes.bool,
};
