import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Alert,
} from '@mui/material';
import AltRouteIcon from '@mui/icons-material/AltRoute';

import AppHeader from '../components/AppHeader';
import ShellLayout from '../components/ShellLayout';
import TripForm from '../components/TripForm';
import RouteCard from '../components/RouteCard';
import RouteComparison from '../components/RouteComparison';
import RouteCardSkeleton from '../components/RouteCardSkeleton';
import RouteMap from '../components/RouteMap';
import HeatmapSlider from '../components/HeatmapSlider';
import { getMockPlanFixture } from '../api/client';
import { usePlanTrip } from '../api/queries';

export default function Planner() {
  const [plan, setPlan] = useState(() => getMockPlanFixture());
  const [selectedRouteId, setSelectedRouteId] = useState(
    () => plan.recommended_route_id || plan.routes[0]?.id
  );
  const [hoveredRouteId, setHoveredRouteId] = useState(null);
  const [sliderHour, setSliderHour] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [serverError, setServerError] = useState(null);

  const planTripMutation = usePlanTrip();

  // Playback timer controller (350ms per timeline hour)
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setSliderHour((prev) => {
        if (prev >= 48) {
          setIsPlaying(false);
          return 48;
        }
        return prev + 1;
      });
    }, 350);

    return () => clearInterval(timer);
  }, [isPlaying]);

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
  // Main Area: Interactive RouteMap Component with 0–48h Heatmap (Step 11 & 12)
  // -------------------------------------------------------------------------
  const mapAreaContent = (
    <RouteMap
      routes={plan.routes}
      selectedRouteId={selectedRouteId}
      hoveredRouteId={hoveredRouteId}
      onSelectRoute={(id) => setSelectedRouteId(id)}
      loadWeightLb={plan.meta.load_weight_lb}
      heatmap={plan.heatmap}
      sliderHour={sliderHour}
      showHeatmap={showHeatmap}
      onToggleHeatmap={() => setShowHeatmap((prev) => !prev)}
      departureTime={plan.meta.departure_time}
    />
  );

  // -------------------------------------------------------------------------
  // Bottom Panel: 0–48h Forecast Timeline Slider (Step 12)
  // -------------------------------------------------------------------------
  const bottomPanelContent = (
    <HeatmapSlider
      sliderHour={sliderHour}
      onSliderChange={(val) => setSliderHour(val)}
      departureTime={plan.meta.departure_time}
      isPlaying={isPlaying}
      onTogglePlay={() => setIsPlaying((prev) => !prev)}
      showHeatmap={showHeatmap}
      onToggleHeatmap={() => setShowHeatmap((prev) => !prev)}
    />
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
