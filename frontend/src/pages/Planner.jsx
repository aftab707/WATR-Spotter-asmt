import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Button,
  Divider,
  Slider,
  IconButton,
  Tooltip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import MapIcon from '@mui/icons-material/Map';
import LayersIcon from '@mui/icons-material/Layers';
import RouteIcon from '@mui/icons-material/Route';
import TimerIcon from '@mui/icons-material/Timer';
import StraightenIcon from '@mui/icons-material/Straighten';
import StarIcon from '@mui/icons-material/Star';
import TuneIcon from '@mui/icons-material/Tune';
import dayjs from 'dayjs';

import AppHeader from '../components/AppHeader';
import ShellLayout from '../components/ShellLayout';
import RiskBadge from '../components/RiskBadge';
import { getMockPlanFixture } from '../api/client';
import {
  formatMiles,
  formatDuration,
  formatDateTime,
  formatWeight,
} from '../lib/formatters';
import { RISK_CONFIG } from '../lib/risk';

export default function Planner() {
  const [plan] = useState(() => getMockPlanFixture());
  const [selectedRouteId, setSelectedRouteId] = useState(
    plan.recommended_route_id || plan.routes[0]?.id
  );
  const [sliderHour, setSliderHour] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const selectedRoute =
    plan.routes.find((r) => r.id === selectedRouteId) || plan.routes[0];

  const departureDayjs = dayjs(plan.meta.departure_time);
  const currentSliderTime = departureDayjs.add(sliderHour, 'hour');

  // -------------------------------------------------------------------------
  // Left Panel: Trip Info & Route Cards
  // -------------------------------------------------------------------------
  const leftPanelContent = (
    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Active Trip Header */}
      <Paper sx={{ p: 2, bgcolor: 'background.default', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>
            Current Trip Corridor
          </Typography>
          <Chip label={`${plan.meta.sampling_interval_miles} mi intervals`} size="small" variant="outlined" />
        </Stack>

        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Chicago, IL → Denver, CO
        </Typography>

        <Stack direction="row" spacing={2} sx={{ mt: 1.5, color: 'text.secondary' }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <TimerIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            <Typography variant="caption">{formatDateTime(plan.meta.departure_time)}</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <StraightenIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
            <Typography variant="caption">Cargo: {formatWeight(plan.meta.load_weight_lb)}</Typography>
          </Stack>
        </Stack>
      </Paper>

      {/* Trip Form Module Preview */}
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TuneIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle2">Trip Configuration</Typography>
          </Stack>
          <Button size="small" variant="text" sx={{ p: 0, minWidth: 'auto', fontSize: '0.75rem' }}>
            Step 9 Form Ready
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
          Autocomplete origins, destinations, truck gross load weights (1–120k lb), and departure date-time bounds.
        </Typography>
      </Paper>

      {/* Evaluated Route Alternatives List */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', color: 'text.secondary', fontSize: '0.75rem', letterSpacing: 0.5 }}>
            Evaluated Routes ({plan.routes.length})
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Ranked by weather safety
          </Typography>
        </Stack>

        <Stack spacing={2}>
          {plan.routes.map((route) => {
            const isSelected = route.id === selectedRouteId;
            const isRec = route.is_recommended;

            return (
              <Paper
                key={route.id}
                onClick={() => setSelectedRouteId(route.id)}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  border: '1px solid',
                  borderColor: isSelected ? 'primary.main' : isRec ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                  bgcolor: isSelected ? 'rgba(56, 189, 248, 0.05)' : 'background.paper',
                  '&:hover': {
                    borderColor: isSelected ? 'primary.main' : 'rgba(255, 255, 255, 0.2)',
                  },
                }}
              >
                {/* Route Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: isSelected ? 'primary.light' : 'text.primary' }}>
                      {route.label}
                    </Typography>
                    <Chip label={`Rank #${route.rank}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                  </Stack>

                  {isRec && (
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
                      }}
                    />
                  )}
                </Stack>

                {/* Metrics Row */}
                <Stack direction="row" spacing={2} sx={{ mb: 1.5, color: 'text.secondary' }}>
                  <Typography variant="body2">
                    <strong>{formatMiles(route.distance_miles)}</strong>
                  </Typography>
                  <Typography variant="body2">•</Typography>
                  <Typography variant="body2">
                    <strong>{formatDuration(route.duration_minutes)}</strong>
                  </Typography>
                  <Typography variant="body2">•</Typography>
                  <Typography variant="caption" sx={{ alignSelf: 'center' }}>
                    ETA: {dayjs(route.arrival_time).format('h:mm A')}
                  </Typography>
                </Stack>

                {/* Risk Breakdown Chips */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
                  <RiskBadge level={route.summary.max_risk} size="small" />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Avg Risk: {route.summary.avg_risk.toFixed(2)}
                  </Typography>
                  {route.summary.severe_miles > 0 && (
                    <Chip
                      label={`${route.summary.severe_miles.toFixed(1)} mi Severe`}
                      size="small"
                      sx={{ height: 20, fontSize: '0.6875rem', bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
                    />
                  )}
                  {route.summary.high_miles > 0 && (
                    <Chip
                      label={`${route.summary.high_miles.toFixed(1)} mi High`}
                      size="small"
                      sx={{ height: 20, fontSize: '0.6875rem', bgcolor: 'rgba(249, 115, 22, 0.15)', color: '#f97316' }}
                    />
                  )}
                </Stack>

                {/* Recommendation Reason */}
                <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'background.default', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontStyle: 'italic' }}>
                    &ldquo;{route.recommendation_reason}&rdquo;
                  </Typography>
                </Box>
              </Paper>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );

  // -------------------------------------------------------------------------
  // Main Area: Interactive Map Canvas Area
  // -------------------------------------------------------------------------
  const mapAreaContent = (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Top Map Floating Toolbar */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <Paper
          sx={{
            px: 2,
            py: 1,
            pointerEvents: 'auto',
            bgcolor: 'rgba(17, 24, 39, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <RouteIcon color="primary" sx={{ fontSize: 20 }} />
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', display: 'block' }}>
                Active: {selectedRoute?.label}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {selectedRoute?.checkpoints?.length} sampled checkpoints • {selectedRoute?.geometry?.coordinates?.length} polyline vertices
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Stack direction="row" spacing={1} sx={{ pointerEvents: 'auto' }}>
          <Chip
            icon={<MapIcon sx={{ fontSize: 14 }} />}
            label="CARTO Dark Matter"
            size="small"
            sx={{ bgcolor: 'rgba(17, 24, 39, 0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <Chip
            icon={<LayersIcon sx={{ fontSize: 14 }} />}
            label="Heatmap Ready"
            size="small"
            sx={{ bgcolor: 'rgba(17, 24, 39, 0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </Stack>
      </Box>

      {/* Map Graphic Canvas Placeholder */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
          background: 'radial-gradient(circle at 50% 50%, #172033 0%, #070a13 85%)',
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            bgcolor: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
          }}
        >
          <MapIcon sx={{ fontSize: 36, color: 'primary.main' }} />
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          Corridor Map Foundation Ready (Step 8)
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 480, mb: 3 }}>
          MapLibre GL basemap and route lines (Step 11) with 0–48h dynamic forecast heatmap overlay (Step 12) will bind to this viewport.
        </Typography>

        {/* Corridor Preview Stat Cards */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ width: '100%', maxWidth: 640 }}>
          <Paper sx={{ p: 2, flex: 1, bgcolor: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography variant="caption" color="text.secondary">
              Origin Coordinate
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {plan.meta.origin?.label || 'Chicago, IL (41.88, -87.63)'}
            </Typography>
          </Paper>

          <Paper sx={{ p: 2, flex: 1, bgcolor: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography variant="caption" color="text.secondary">
              Destination Coordinate
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {plan.meta.destination?.label || 'Denver, CO (39.74, -104.99)'}
            </Typography>
          </Paper>

          <Paper sx={{ p: 2, flex: 1, bgcolor: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography variant="caption" color="text.secondary">
              Corridor Heatmap Points
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {plan.heatmap.points.length} unique points
            </Typography>
          </Paper>
        </Stack>
      </Box>
    </Box>
  );

  // -------------------------------------------------------------------------
  // Bottom Panel: 0-48h Heatmap Slider & Risk Palette Strip
  // -------------------------------------------------------------------------
  const bottomPanelContent = (
    <Box sx={{ p: 2, px: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ xs: 'stretch', md: 'center' }}>
        {/* Slider Controls */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: { md: 280 } }}>
          <Tooltip title={isPlaying ? 'Pause slider' : 'Play 48-hour timeline'}>
            <IconButton
              color="primary"
              onClick={() => setIsPlaying(!isPlaying)}
              sx={{ border: '1px solid', borderColor: 'primary.main', p: 1 }}
            >
              {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
          </Tooltip>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              +{sliderHour}h Post Departure
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Area forecast: {currentSliderTime.format('MMM D, h:00 A')}
            </Typography>
          </Box>
        </Stack>

        {/* 0-48h Slider */}
        <Box sx={{ flex: 1, px: 1 }}>
          <Slider
            value={sliderHour}
            min={0}
            max={48}
            step={1}
            marks={[
              { value: 0, label: '0h' },
              { value: 12, label: '+12h' },
              { value: 24, label: '+24h' },
              { value: 36, label: '+36h' },
              { value: 48, label: '+48h' },
            ]}
            onChange={(_, val) => setSliderHour(val)}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `+${v}h`}
            sx={{
              color: 'primary.main',
              '& .MuiSlider-markLabel': {
                fontSize: '0.7rem',
                color: 'text.secondary',
              },
            }}
          />
        </Box>

        <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

        {/* Standard Risk Palette Legend */}
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          {Object.values(RISK_CONFIG).map((cfg) => (
            <RiskBadge key={cfg.key} level={cfg.level} size="small" />
          ))}
        </Stack>
      </Stack>
    </Box>
  );

  return (
    <ShellLayout
      header={<AppHeader />}
      leftPanel={leftPanelContent}
      mapArea={mapAreaContent}
      bottomPanel={bottomPanelContent}
    />
  );
}
