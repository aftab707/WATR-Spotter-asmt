import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Divider,
  Slider,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import dayjs from 'dayjs';

import AppHeader from '../components/AppHeader';
import ShellLayout from '../components/ShellLayout';
import RiskBadge from '../components/RiskBadge';
import TripForm from '../components/TripForm';
import RouteCard from '../components/RouteCard';
import RouteComparison from '../components/RouteComparison';
import RouteCardSkeleton from '../components/RouteCardSkeleton';
import RouteMap from '../components/RouteMap';
import { getMockPlanFixture } from '../api/client';
import { usePlanTrip } from '../api/queries';
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
  // Main Area: Interactive RouteMap Component (Step 11)
  // -------------------------------------------------------------------------
  const mapAreaContent = (
    <RouteMap
      routes={plan.routes}
      selectedRouteId={selectedRouteId}
      hoveredRouteId={hoveredRouteId}
      onSelectRoute={(id) => setSelectedRouteId(id)}
      loadWeightLb={plan.meta.load_weight_lb}
    />
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
