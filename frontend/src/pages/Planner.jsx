import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Alert,
  Button,
} from '@mui/material';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import MapIcon from '@mui/icons-material/Map';

import AppHeader from '../components/AppHeader';
import ShellLayout from '../components/ShellLayout';
import TripForm from '../components/TripForm';
import RouteCard from '../components/RouteCard';
import RouteComparison from '../components/RouteComparison';
import RouteCardSkeleton from '../components/RouteCardSkeleton';
import RouteMap from '../components/RouteMap';
import HeatmapSlider from '../components/HeatmapSlider';
import RiskStrip from '../components/RiskStrip';
import CheckpointTable from '../components/CheckpointTable';
import { getMockPlanFixture } from '../api/client';
import { usePlanTrip } from '../api/queries';

export default function Planner() {
  const [plan, setPlan] = useState(() => getMockPlanFixture());
  const [selectedRouteId, setSelectedRouteId] = useState(
    () => plan.recommended_route_id || plan.routes[0]?.id
  );
  const [hoveredRouteId, setHoveredRouteId] = useState(null);
  const [focusedCheckpoint, setFocusedCheckpoint] = useState(null);
  const [activeTab, setActiveTab] = useState('map'); // 'map' | 'checkpoints' | 'compare'
  const [mobileTab, setMobileTab] = useState('controls'); // 'controls' | 'map'
  const [sliderHour, setSliderHour] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [serverError, setServerError] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(true); // Default to realistic storm benchmark scenario

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
    setIsDemoMode(false);
    try {
      const response = await planTripMutation.mutateAsync(formData);
      setPlan(response);
      setSelectedRouteId(response.recommended_route_id || response.routes[0]?.id);
      setSliderHour(0);
      setFocusedCheckpoint(null);
      setMobileTab('map');
      setActiveTab('map');
    } catch (err) {
      setServerError(err.message || 'Failed to calculate safe routes. Please try again.');
    }
  };

  // Switch between Severe Storm Demo and Live API
  const handleToggleDemoMode = () => {
    if (!isDemoMode) {
      setIsDemoMode(true);
      const fixture = getMockPlanFixture();
      setPlan(fixture);
      setSelectedRouteId(fixture.recommended_route_id || fixture.routes[0]?.id);
      setSliderHour(0);
      setFocusedCheckpoint(null);
    } else {
      setIsDemoMode(false);
      handlePlanSubmit(plan.meta);
    }
  };

  // Identify the fastest route candidate among all returned routes
  const fastestRouteId = [...plan.routes].sort(
    (a, b) => a.duration_minutes - b.duration_minutes
  )[0]?.id;

  // Active selected route object
  const activeRoute =
    plan.routes.find((r) => r.id === selectedRouteId) || plan.routes[0];

  // -------------------------------------------------------------------------
  // Left Panel: Trip Form, Comparison View & Evaluated Route Cards
  // -------------------------------------------------------------------------
  const leftPanelContent = (
    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Trip Planning Form with auto-collapse capability */}
      <TripForm
        onSubmit={handlePlanSubmit}
        isSubmitting={planTripMutation.isPending}
        serverError={serverError}
        hasRoutes={plan.routes.length > 0}
      />

      {/* Warnings Banner if any emitted by backend */}
      {plan.meta.warnings && plan.meta.warnings.length > 0 && (
        <Alert severity="warning" sx={{ fontSize: '0.8125rem' }}>
          {plan.meta.warnings.join(' ')}
        </Alert>
      )}

      {/* Trade-off Comparison Summary: Recommended vs Fastest */}
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
                onSelectCheckpoint={(cp) => {
                  setFocusedCheckpoint(cp);
                  setMobileTab('map');
                  setActiveTab('map');
                }}
                onViewCheckpoints={() => {
                  setSelectedRouteId(route.id);
                  setActiveTab('checkpoints');
                }}
              />
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );

  // -------------------------------------------------------------------------
  // Main Workspace: Map with Floating Slider OR Checkpoint Table OR Comparison
  // -------------------------------------------------------------------------
  const mainWorkspaceContent = (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* 1. Map Canvas View: ALWAYS mounted with visibility so WebGL context & cached tiles stay alive */}
      <Box
        sx={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          visibility: activeTab === 'map' ? 'visible' : 'hidden',
          pointerEvents: activeTab === 'map' ? 'auto' : 'none',
          zIndex: 1,
        }}
      >
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
          focusedCheckpoint={focusedCheckpoint}
          activeTab={activeTab}
        />

        {/* Floating Sleek 0-48h Forecast Timeline Controller (Never crushes the map) */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 32px)',
            maxWidth: 780,
            zIndex: 10,
          }}
        >
          <HeatmapSlider
            sliderHour={sliderHour}
            onSliderChange={(val) => setSliderHour(val)}
            departureTime={plan.meta.departure_time}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying((prev) => !prev)}
            showHeatmap={showHeatmap}
            onToggleHeatmap={() => setShowHeatmap((prev) => !prev)}
          />
        </Box>
      </Box>

      {/* 2. Checkpoints Tab View: Rendered on top when activeTab === 'checkpoints' */}
      {activeTab === 'checkpoints' && (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            position: 'relative',
            zIndex: 2,
            bgcolor: 'background.default',
            p: { xs: 1.5, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            overflowY: 'auto',
          }}
        >
          {activeRoute && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {activeRoute.label} Corridor Risk Exposure
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Distance-proportional risk strip ({activeRoute.distance_miles.toFixed(1)} miles total) • Click segment to center on map
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<MapIcon />}
                  onClick={() => setActiveTab('map')}
                  sx={{ fontSize: '0.75rem', py: 0.5 }}
                >
                  View on Map
                </Button>
              </Stack>
              <RiskStrip
                checkpoints={activeRoute.checkpoints}
                totalDistanceMiles={activeRoute.distance_miles}
                height={16}
                showLabels
                onSelectCheckpoint={(cp) => {
                  setFocusedCheckpoint(cp);
                  setActiveTab('map');
                }}
                selectedCheckpointIndex={focusedCheckpoint?.index}
              />
            </Paper>
          )}

          <CheckpointTable
            checkpoints={activeRoute?.checkpoints || []}
            onSelectCheckpoint={(cp) => {
              setFocusedCheckpoint(cp);
              setActiveTab('map');
            }}
            selectedCheckpointIndex={focusedCheckpoint?.index}
          />
        </Box>
      )}

      {/* 3. Compare Tab View: Rendered on top when activeTab === 'compare' */}
      {activeTab === 'compare' && (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            position: 'relative',
            zIndex: 2,
            bgcolor: 'background.default',
            p: { xs: 2, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
            overflowY: 'auto',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Route Alternatives Comparison
          </Typography>
          <RouteComparison routes={plan.routes} />
          <Stack spacing={2}>
            {plan.routes.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                isSelected={route.id === selectedRouteId}
                isHovered={route.id === hoveredRouteId}
                isFastest={route.id === fastestRouteId}
                onSelect={() => setSelectedRouteId(route.id)}
                onSelectCheckpoint={(cp) => {
                  setFocusedCheckpoint(cp);
                  setActiveTab('map');
                }}
                onViewCheckpoints={() => setActiveTab('checkpoints')}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );

  return (
    <ShellLayout
      header={
        <AppHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
          checkpointCount={activeRoute?.checkpoints?.length || 0}
          isDemoMode={isDemoMode}
          onToggleDemoMode={handleToggleDemoMode}
          onRefreshPlan={() => (isDemoMode ? handleToggleDemoMode() : handlePlanSubmit(plan.meta))}
        />
      }
      leftPanel={leftPanelContent}
      mainArea={mainWorkspaceContent}
      mobileTab={mobileTab}
      onMobileTabChange={setMobileTab}
    />
  );
}
