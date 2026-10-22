import PropTypes from 'prop-types';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Divider,
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ShieldIcon from '@mui/icons-material/Shield';
import TimerIcon from '@mui/icons-material/Timer';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { formatDuration } from '../lib/formatters';

/**
 * Route Comparison View highlighting the trade-off between the Fastest Route and the Recommended Route.
 *
 * Per Step 10: "compare view of fastest vs recommended trade-off".
 */
export default function RouteComparison({ routes }) {
  if (!routes || routes.length === 0) return null;

  const recommendedRoute = routes.find((r) => r.is_recommended);
  const fastestRoute = [...routes].sort((a, b) => a.duration_minutes - b.duration_minutes)[0];

  // Case 1: All routes encounter No Travel hazards
  if (!recommendedRoute) {
    return (
      <Paper
        sx={{
          p: 2,
          bgcolor: 'rgba(168, 85, 247, 0.08)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          borderRadius: 2,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <WarningAmberIcon sx={{ color: '#a855f7', fontSize: 24 }} />
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#c084fc' }}>
              Hazard Alert: No Safe Route Available
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
              All evaluated routes encounter No Travel weather hazards (winds &gt;= 55 mph or severe storm on loaded trailer). Delay departure or explore an alternate travel window.
            </Typography>
          </Box>
        </Stack>
      </Paper>
    );
  }

  // Case 2: Recommended route is also the fastest route
  if (recommendedRoute.id === fastestRoute.id) {
    return (
      <Paper
        sx={{
          p: 2,
          bgcolor: 'rgba(34, 197, 94, 0.06)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          borderRadius: 2,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: 24 }} />
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'success.light' }}>
              Optimal Route: Fastest &amp; Safest
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
              {recommendedRoute.label} is both the fastest route ({formatDuration(recommendedRoute.duration_minutes)}) and delivers the lowest weather hazard exposure.
            </Typography>
          </Box>
        </Stack>
      </Paper>
    );
  }

  // Case 3: Recommended route is safer but adds travel time vs fastest
  const addedTimeMin = Math.round(recommendedRoute.duration_minutes - fastestRoute.duration_minutes);
  const severeAvoided = Math.max(
    0,
    round(fastestRoute.summary.severe_miles - recommendedRoute.summary.severe_miles)
  );
  const highAvoided = Math.max(
    0,
    round(fastestRoute.summary.high_miles - recommendedRoute.summary.high_miles)
  );

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 2,
        border: '1px solid rgba(56, 189, 248, 0.25)',
      }}
    >
      {/* Title */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <CompareArrowsIcon sx={{ color: 'primary.main', fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Trade-off: Recommended vs Fastest
        </Typography>
      </Stack>

      {/* Metrics Comparison Row */}
      <Stack direction="row" spacing={2} divider={<Divider orientation="vertical" flexItem />} sx={{ mb: 1.5 }}>
        {/* Extra Time Trade-off */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Extra Travel Time
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="baseline" sx={{ mt: 0.25 }}>
            <TimerIcon sx={{ fontSize: 16, color: 'warning.main', alignSelf: 'center' }} />
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.light' }}>
              +{addedTimeMin} min
            </Typography>
          </Stack>
        </Box>

        {/* Hazard Exposure Avoided */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Hazard Avoided
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="baseline" sx={{ mt: 0.25 }}>
            <ShieldIcon sx={{ fontSize: 16, color: 'success.main', alignSelf: 'center' }} />
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.light' }}>
              {severeAvoided > 0 ? `${severeAvoided} mi Severe` : `${highAvoided} mi High`}
            </Typography>
          </Stack>
        </Box>

        {/* Average Risk Comparison */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Risk Score
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', mt: 0.25 }}>
            {recommendedRoute.summary.avg_risk.toFixed(2)}{' '}
            <Typography component="span" variant="caption" color="text.secondary">
              vs {fastestRoute.summary.avg_risk.toFixed(2)}
            </Typography>
          </Typography>
        </Box>
      </Stack>

      {/* Narrative Explanation */}
      <Box
        sx={{
          p: 1.25,
          borderRadius: 1,
          bgcolor: 'background.default',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.4 }}>
          Taking <strong>{recommendedRoute.label}</strong> adds {addedTimeMin} min vs fastest, but{' '}
          {severeAvoided > 0 ? (
            <>
              bypasses <strong>{severeAvoided} miles</strong> of dangerous severe storm conditions.
            </>
          ) : (
            <>significantly reduces weather hazard exposure along the corridor.</>
          )}
        </Typography>
      </Box>
    </Paper>
  );
}

function round(val) {
  return Math.round(val * 10) / 10;
}

RouteComparison.propTypes = {
  routes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      rank: PropTypes.number.isRequired,
      is_recommended: PropTypes.bool.isRequired,
      duration_minutes: PropTypes.number.isRequired,
      summary: PropTypes.shape({
        no_travel_miles: PropTypes.number,
        severe_miles: PropTypes.number,
        high_miles: PropTypes.number,
        avg_risk: PropTypes.number.isRequired,
      }).isRequired,
    })
  ),
};
