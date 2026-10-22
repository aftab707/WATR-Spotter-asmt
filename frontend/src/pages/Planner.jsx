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
import AltRouteIcon from '@mui/icons-material/AltRoute';
import dayjs from 'dayjs';

import AppHeader from '../components/AppHeader';
import ShellLayout from '../components/ShellLayout';
import RiskBadge from '../components/RiskBadge';
import TripForm from '../components/TripForm';
import RouteCard from '../components/RouteCard';
import RouteComparison from '../components/RouteComparison';
import RouteCardSkeleton from '../components/RouteCardSkeleton';
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
  const [hoveredRouteId, setHoveredRouteId] = useState(null);
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

  const activeRoute =
    plan.routes.find((r) => r.id === (hoveredRouteId || selectedRouteId)) ||
    plan.routes[0];

  const selectedRoute =
    plan.routes.find((r) => r.id === selectedRouteId) || plan.routes[0];

  // Identify the fastest route candidate among all returned routes
  const fastestRouteId = [...plan.routes].sort(
    (a, b) => a.duration_minutes - b.duration_minutes
  )[0]?.id;

  const departureDayjs = dayjs(plan.meta.departure_time);
  const currentSliderTime = departureDayjs.add(sliderHour, 'hour');

  // -------------------------------------------------------------------------
  // Left Panel: Trip Form, Comparison View & Evaluated Route Cards
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

      {/* Trade-off Comparison: Recommended vs Fastest (Step 10) */}
      {!planTripMutation.isPending && plan.routes.length > 0 && (
        <RouteComparison routes={plan.routes} />
      )}

      {/* Evaluated Route Alternatives List */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography
            variant="subtitle2"
            sx={{
              textTransform: 'uppercase',
              color: 'text.secondary',
              fontSize: '0.75rem',
              letterSpacing: 0.5,
              fontWeight: 700,
            }}
          >
            Evaluated Route Alternatives ({plan.routes.length})
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Ranked by weather safety
          </Typography>
        </Stack>

        {planTripMutation.isPending ? (
          <RouteCardSkeleton />
        ) : plan.routes.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              textAlign: 'center',
              bgcolor: 'background.paper',
              borderRadius: 2,
            }}
          >
            <AltRouteIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
            <Typography variant="subtitle2">No Routes Found</Typography>
            <Typography variant="caption" color="text.secondary">
              Try adjusting your origin, destination, or departure time.
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {plan.routes.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                isSelected={route.id === selectedRouteId}
                isHovered={route.id === hoveredRouteId}
                isFastest={route.id === fastestRouteId}
                onSelect={() => setSelectedRouteId(route.id)}
                onMouseEnter={() => setHoveredRouteId(route.id)}
                onMouseLeave={() => setHoveredRouteId(null)}
              />
            ))}
          </Stack>
        )}
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
            bgcolor: 'rgba(17, 24, 39, 0.88)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 2,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <RouteIcon color="primary" sx={{ fontSize: 22 }} />
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {activeRoute?.label}
                </Typography>
                {hoveredRouteId && hoveredRouteId !== selectedRouteId && (
                  <Chip label="Hovered" size="small" sx={{ height: 16, fontSize: '0.625rem' }} />
                )}
                {activeRoute?.is_recommended && (
                  <Chip
                    label="Recommended"
                    size="small"
                    color="success"
                    sx={{ height: 16, fontSize: '0.625rem', fontWeight: 700 }}
                  />
                )}
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                {activeRoute?.checkpoints?.length} sampled checkpoints • {activeRoute?.geometry?.coordinates?.length} polyline vertices
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Stack direction="row" spacing={1} sx={{ pointerEvents: 'auto' }}>
          <Chip
            icon={<MapIcon sx={{ fontSize: 14 }} />}
            label="CARTO Dark Matter"
            size="small"
            sx={{
              bgcolor: 'rgba(17, 24, 39, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          />
          <Chip
            icon={<LayersIcon sx={{ fontSize: 14 }} />}
            label="Heatmap Ready"
            size="small"
            sx={{
              bgcolor: 'rgba(17, 24, 39, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
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
