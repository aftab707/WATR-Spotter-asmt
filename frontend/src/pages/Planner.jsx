import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Divider,
  Slider,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import MapIcon from '@mui/icons-material/Map';
import LayersIcon from '@mui/icons-material/Layers';
import RouteIcon from '@mui/icons-material/Route';
import StarIcon from '@mui/icons-material/Star';
import dayjs from 'dayjs';

import AppHeader from '../components/AppHeader';
import ShellLayout from '../components/ShellLayout';
import RiskBadge from '../components/RiskBadge';
import TripForm from '../components/TripForm';
import { getMockPlanFixture } from '../api/client';
import { usePlanTrip } from '../api/queries';
import {
  formatMiles,
  formatDuration,
} from '../lib/formatters';
import { RISK_CONFIG } from '../lib/risk';

export default function Planner() {
  const [plan, setPlan] = useState(() => getMockPlanFixture());
  const [selectedRouteId, setSelectedRouteId] = useState(
    () => plan.recommended_route_id || plan.routes[0]?.id
  );
  const [sliderHour, setSliderHour] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [serverError, setServerError] = useState(null);

  const planTripMutation = usePlanTrip();

  const handlePlanSubmit = async (formData) => {
    setServerError(null);
    try {
      const response = await planTripMutation.mutateAsync(formData);
      setPlan(response);
      setSelectedRouteId(response.recommended_route_id || response.routes[0]?.id);
      setSliderHour(0);
    } catch (err) {
      setServerError(err.message || 'Failed to calculate safe routes. Please try again.');
    }
  };

  const selectedRoute =
    plan.routes.find((r) => r.id === selectedRouteId) || plan.routes[0];

  const departureDayjs = dayjs(plan.meta.departure_time);
  const currentSliderTime = departureDayjs.add(sliderHour, 'hour');

  // -------------------------------------------------------------------------
  // Left Panel: Trip Form & Evaluated Route Cards
  // -------------------------------------------------------------------------
  const leftPanelContent = (
    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Trip Planning Form (Step 9) */}
      <TripForm
        onSubmit={handlePlanSubmit}
        isSubmitting={planTripMutation.isPending}
        serverError={serverError}
      />

      {/* Warnings Banner if any emitted by backend */}
      {plan.meta.warnings && plan.meta.warnings.length > 0 && (
        <Alert severity="warning" sx={{ fontSize: '0.8125rem' }}>
          {plan.meta.warnings.join(' ')}
        </Alert>
      )}

      {/* Evaluated Route Alternatives List */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography
            variant="subtitle2"
            sx={{ textTransform: 'uppercase', color: 'text.secondary', fontSize: '0.75rem', letterSpacing: 0.5 }}
          >
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
                  borderColor: isSelected
                    ? 'primary.main'
                    : isRec
                      ? 'rgba(34, 197, 94, 0.4)'
                      : 'rgba(255, 255, 255, 0.08)',
                  bgcolor: isSelected ? 'rgba(56, 189, 248, 0.05)' : 'background.paper',
                  '&:hover': {
                    borderColor: isSelected ? 'primary.main' : 'rgba(255, 255, 255, 0.2)',
                  },
                }}
              >
                {/* Route Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 700, color: isSelected ? 'primary.light' : 'text.primary' }}
                    >
                      {route.label}
                    </Typography>
                    <Chip
                      label={`Rank #${route.rank}`}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
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
                      sx={{
                        height: 20,
                        fontSize: '0.6875rem',
                        bgcolor: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                      }}
                    />
                  )}
                  {route.summary.high_miles > 0 && (
                    <Chip
                      label={`${route.summary.high_miles.toFixed(1)} mi High`}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.6875rem',
                        bgcolor: 'rgba(249, 115, 22, 0.15)',
                        color: '#f97316',
                      }}
                    />
                  )}
                </Stack>

                {/* Recommendation Reason */}
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'background.default',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
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
          Corridor Route Visualization (Step 11 & 12)
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 480, mb: 3 }}>
          MapLibre GL basemap with 3 interactive routes, checkpoint safety markers, and the 0–48h dynamic forecast heatmap overlay.
        </Typography>

        {/* Corridor Preview Stat Cards */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ width: '100%', maxWidth: 640 }}>
          <Paper sx={{ p: 2, flex: 1, bgcolor: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography variant="caption" color="text.secondary">
              Corridor Distance
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {formatMiles(selectedRoute?.distance_miles)}
            </Typography>
          </Paper>

          <Paper sx={{ p: 2, flex: 1, bgcolor: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography variant="caption" color="text.secondary">
              Travel Duration
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {formatDuration(selectedRoute?.duration_minutes)}
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
      header={<AppHeader onRefreshPlan={() => handlePlanSubmit(plan.meta)} />}
      leftPanel={leftPanelContent}
      mapArea={mapAreaContent}
      bottomPanel={bottomPanelContent}
    />
  );
}
