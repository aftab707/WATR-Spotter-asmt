import PropTypes from 'prop-types';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Tooltip,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import SpeedIcon from '@mui/icons-material/Speed';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';

import RiskBadge from './RiskBadge';
import RiskStrip from './RiskStrip';
import { formatMiles, formatDuration, formatTimeOnly } from '../lib/formatters';

/**
 * Route Card displaying evaluated route metrics, risk exposure, and comparative recommendation reasoning.
 *
 * Per Step 10 & Section 8 UI/UX Quality Bar:
 * - Recommended route is visually obvious.
 * - Shows distance, duration, arrival ETA, Severe/High miles, avg risk, risk chip, "Recommended" badge, and short "Why this route" text.
 * - Select and hover states sync with map.
 * - Keyboard accessible.
 */
export default function RouteCard({
  route,
  isSelected = false,
  isHovered = false,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  isFastest = false,
  onSelectCheckpoint,
}) {
  const isRec = route.is_recommended;
  const hasNoTravel = route.summary.no_travel_miles > 0;
  const severeMiles = route.summary.severe_miles || 0;
  const highMiles = route.summary.high_miles || 0;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onSelect) onSelect();
    }
  };

  return (
    <Paper
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-label={`${route.label}, rank ${route.rank}${isRec ? ', recommended route' : ''}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      sx={{
        p: 2,
        cursor: 'pointer',
        borderRadius: 2,
        transition: 'all 0.15s ease-in-out',
        outline: 'none',
        border: '1.5px solid',
        borderColor: isSelected
          ? 'primary.main'
          : isHovered
            ? 'primary.light'
            : isRec
              ? 'rgba(34, 197, 94, 0.45)'
              : 'rgba(255, 255, 255, 0.08)',
        bgcolor: isSelected
          ? 'rgba(56, 189, 248, 0.07)'
          : isHovered
            ? 'rgba(255, 255, 255, 0.03)'
            : isRec
              ? 'rgba(34, 197, 94, 0.02)'
              : 'background.paper',
        boxShadow: isSelected
          ? '0 0 0 1px #38bdf8, 0 4px 12px rgba(0,0,0,0.3)'
          : isHovered
            ? '0 4px 12px rgba(0,0,0,0.2)'
            : 'none',
        '&:focus-visible': {
          borderColor: 'primary.light',
          boxShadow: '0 0 0 3px rgba(56, 189, 248, 0.35)',
        },
      }}
    >
      {/* Top Header Row */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.25 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              color: isSelected ? 'primary.light' : 'text.primary',
              fontSize: '0.9375rem',
            }}
          >
            {route.label}
          </Typography>

          <Chip
            label={`#${route.rank}`}
            size="small"
            variant="outlined"
            sx={{
              height: 20,
              fontSize: '0.6875rem',
              fontWeight: 700,
              borderColor: 'rgba(255,255,255,0.15)',
            }}
          />

          {isFastest && (
            <Tooltip title="Shortest overall travel duration among candidates">
              <Chip
                icon={<SpeedIcon sx={{ fontSize: '13px !important', color: '#38bdf8 !important' }} />}
                label="Fastest"
                size="small"
                variant="outlined"
                sx={{
                  height: 20,
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  borderColor: 'rgba(56, 189, 248, 0.3)',
                  color: 'primary.light',
                }}
              />
            </Tooltip>
          )}
        </Stack>

        {/* Status / Recommendation Badge */}
        {isRec ? (
          <Chip
            icon={<StarIcon sx={{ fontSize: '14px !important', color: '#052e16 !important' }} />}
            label="Recommended"
            size="small"
            sx={{
              bgcolor: 'success.main',
              color: '#052e16',
              fontWeight: 700,
              fontSize: '0.72rem',
              height: 22,
              px: 0.5,
              boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
            }}
          />
        ) : hasNoTravel ? (
          <Chip
            icon={<BlockIcon sx={{ fontSize: '14px !important', color: '#ffffff !important' }} />}
            label="No Travel"
            size="small"
            sx={{
              bgcolor: 'error.dark',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.72rem',
              height: 22,
            }}
          />
        ) : null}
      </Stack>

      {/* Core Metrics: Distance • Duration • ETA */}
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{ mb: 1.5, color: 'text.secondary', fontSize: '0.8125rem' }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {formatMiles(route.distance_miles)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          •
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {formatDuration(route.duration_minutes)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          •
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          ETA: {formatTimeOnly(route.arrival_time)}
        </Typography>
      </Stack>

      {/* Risk Metrics Breakdown */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
        <RiskBadge level={route.summary.max_risk} size="small" />

        <Tooltip title="Distance-weighted average risk score across all sampled checkpoints">
          <Chip
            label={`Avg Risk: ${route.summary.avg_risk.toFixed(2)}`}
            size="small"
            variant="outlined"
            sx={{
              height: 22,
              fontSize: '0.7rem',
              borderColor: 'rgba(255,255,255,0.12)',
              color: 'text.secondary',
            }}
          />
        </Tooltip>

        {severeMiles > 0 ? (
          <Tooltip title="Corridor miles exposed to Severe weather / roll-over hazard">
            <Chip
              icon={<WarningAmberIcon sx={{ fontSize: '13px !important', color: '#ef4444 !important' }} />}
              label={`${severeMiles.toFixed(1)} mi Severe`}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 600,
                bgcolor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                borderColor: 'rgba(239, 68, 68, 0.3)',
              }}
            />
          </Tooltip>
        ) : (
          <Tooltip title="Zero miles exposed to Severe risk">
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: '13px !important', color: '#22c55e !important' }} />}
              label="0 mi Severe"
              size="small"
              variant="outlined"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                borderColor: 'rgba(34, 197, 94, 0.25)',
                color: '#22c55e',
              }}
            />
          </Tooltip>
        )}

        {highMiles > 0 && (
          <Tooltip title="Corridor miles exposed to High wind/precipitation hazard">
            <Chip
              label={`${highMiles.toFixed(1)} mi High`}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 600,
                bgcolor: 'rgba(249, 115, 22, 0.15)',
                color: '#f97316',
              }}
            />
          </Tooltip>
        )}
      </Stack>

      {/* Distance-Proportional Risk Strip (Step 13) */}
      {route.checkpoints && route.checkpoints.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <RiskStrip
            checkpoints={route.checkpoints}
            totalDistanceMiles={route.distance_miles}
            height={8}
            onSelectCheckpoint={onSelectCheckpoint}
          />
        </Box>
      )}

      {/* "Why this route" Comparative Explanation Callout */}
      <Box
        sx={{
          p: 1.25,
          borderRadius: 1,
          bgcolor: isRec ? 'rgba(34, 197, 94, 0.05)' : 'background.default',
          border: '1px solid',
          borderColor: isRec ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.06)',
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="flex-start">
          <LightbulbOutlinedIcon
            sx={{
              fontSize: 16,
              color: isRec ? 'success.main' : 'text.secondary',
              mt: '1px',
              flexShrink: 0,
            }}
          />
          <Box>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: isRec ? 'success.main' : 'text.secondary',
                display: 'block',
                textTransform: 'uppercase',
                fontSize: '0.65rem',
                letterSpacing: 0.5,
              }}
            >
              Why this route
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: isRec ? 'text.primary' : 'text.secondary',
                lineHeight: 1.35,
                display: 'block',
              }}
            >
              {route.recommendation_reason}
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
}

RouteCard.propTypes = {
  route: PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    rank: PropTypes.number.isRequired,
    is_recommended: PropTypes.bool.isRequired,
    distance_miles: PropTypes.number.isRequired,
    duration_minutes: PropTypes.number.isRequired,
    arrival_time: PropTypes.string.isRequired,
    summary: PropTypes.shape({
      no_travel_miles: PropTypes.number,
      severe_miles: PropTypes.number,
      high_miles: PropTypes.number,
      moderate_miles: PropTypes.number,
      low_miles: PropTypes.number,
      avg_risk: PropTypes.number.isRequired,
      max_risk: PropTypes.number.isRequired,
      max_risk_label: PropTypes.string.isRequired,
    }).isRequired,
    recommendation_reason: PropTypes.string.isRequired,
  }).isRequired,
  isSelected: PropTypes.bool,
  isHovered: PropTypes.bool,
  onSelect: PropTypes.func,
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
  isFastest: PropTypes.bool,
  onSelectCheckpoint: PropTypes.func,
};
