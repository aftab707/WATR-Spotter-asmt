import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import Map, {
  Source,
  Layer,
  Popup,
  NavigationControl,
  FullscreenControl,
  ScaleControl,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import LayersIcon from '@mui/icons-material/Layers';
import AirIcon from '@mui/icons-material/Air';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import RiskBadge from './RiskBadge';
import { formatMph, formatInHr, formatDateTime } from '../lib/formatters';
import { RISK_CONFIG } from '../lib/risk';

const CARTO_DARK_MATTER_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const ROUTE_LINE_COLORS = {
  r1: '#38bdf8', // Sky Blue (Route A)
  r2: '#10b981', // Emerald Green (Route B)
  r3: '#a855f7', // Purple (Route C)
};

const DEFAULT_ROUTE_COLOR = '#94a3b8';

export default function RouteMap({
  routes = [],
  selectedRouteId,
  hoveredRouteId,
  onSelectRoute,
  loadWeightLb,
}) {
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState(null);
  const [showLegend, setShowLegend] = useState(true);

  const activeRoute = useMemo(() => {
    return routes.find((r) => r.id === (hoveredRouteId || selectedRouteId)) || routes[0] || null;
  }, [routes, hoveredRouteId, selectedRouteId]);

  // Compute geographical bounding box covering all routes
  const corridorBounds = useMemo(() => {
    if (!routes || routes.length === 0) return null;
    let minLon = 180;
    let maxLon = -180;
    let minLat = 90;
    let maxLat = -90;
    let hasCoords = false;

    for (const r of routes) {
      if (r.geometry?.coordinates) {
        for (const [lon, lat] of r.geometry.coordinates) {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          hasCoords = true;
        }
      }
    }

    if (!hasCoords) return null;
    return [
      [minLon, minLat],
      [maxLon, maxLat],
    ];
  }, [routes]);

  // Camera fit-to-bounds callback
  const fitCorridor = useCallback(() => {
    if (mapRef.current && corridorBounds) {
      mapRef.current.fitBounds(corridorBounds, {
        padding: { top: 60, bottom: 60, left: 60, right: 60 },
        duration: 900,
        maxZoom: 12,
      });
    }
  }, [corridorBounds]);

  // Automatically fit bounds on initial map load or when routes change
  useEffect(() => {
    if (mapLoaded && corridorBounds) {
      fitCorridor();
    }
  }, [mapLoaded, corridorBounds, fitCorridor]);

  // GeoJSON FeatureCollection for all route lines
  const routesGeoJson = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: routes.map((r) => {
        const isSelected = r.id === selectedRouteId;
        const isHovered = r.id === hoveredRouteId;
        const baseColor = ROUTE_LINE_COLORS[r.id] || DEFAULT_ROUTE_COLOR;

        return {
          type: 'Feature',
          id: r.id,
          geometry: r.geometry,
          properties: {
            id: r.id,
            label: r.label,
            is_recommended: r.is_recommended,
            is_selected: isSelected,
            is_hovered: isHovered,
            color: baseColor,
            lineWidth: isSelected ? 6 : isHovered ? 5 : 3.5,
            lineOpacity: isSelected ? 1.0 : isHovered ? 0.85 : 0.45,
          },
        };
      }),
    };
  }, [routes, selectedRouteId, hoveredRouteId]);

  // GeoJSON FeatureCollection for checkpoints of the active route
  const checkpointsGeoJson = useMemo(() => {
    if (!activeRoute?.checkpoints) {
      return { type: 'FeatureCollection', features: [] };
    }

    return {
      type: 'FeatureCollection',
      features: activeRoute.checkpoints.map((cp) => ({
        type: 'Feature',
        id: `${activeRoute.id}-cp-${cp.index}`,
        geometry: {
          type: 'Point',
          coordinates: [cp.lon, cp.lat],
        },
        properties: {
          index: cp.index,
          mile: cp.mile,
          lat: cp.lat,
          lon: cp.lon,
          eta: cp.eta,
          risk: cp.risk,
          risk_label: cp.risk_label,
          wind_mph: cp.wind_mph,
          rain_in_hr: cp.rain_in_hr,
          snow_in_hr: cp.snow_in_hr,
          drivers: Array.isArray(cp.drivers) ? cp.drivers.join(', ') : '',
          load_rule_applied: Boolean(cp.load_rule_applied),
          segment_miles: cp.segment_miles,
          route_label: activeRoute.label,
        },
      })),
    };
  }, [activeRoute]);

  // Handle click on map layers (route line or checkpoint circle)
  const handleMapClick = (event) => {
    const features = event.features || [];
    const checkpointFeature = features.find((f) => f.layer.id === 'checkpoint-markers-layer');
    if (checkpointFeature) {
      const [lon, lat] = checkpointFeature.geometry.coordinates;
      setSelectedCheckpoint({
        ...checkpointFeature.properties,
        lon,
        lat,
      });
      return;
    }

    const routeFeature = features.find((f) => f.layer.id === 'route-lines-layer');
    if (routeFeature) {
      const clickedRouteId = routeFeature.properties.id;
      if (onSelectRoute && clickedRouteId) {
        onSelectRoute(clickedRouteId);
      }
      return;
    }

    // Dismiss checkpoint popup when clicking elsewhere on map
    setSelectedCheckpoint(null);
  };

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: -96.0,
          latitude: 40.5,
          zoom: 4.5,
        }}
        mapStyle={CARTO_DARK_MATTER_STYLE}
        onLoad={() => setMapLoaded(true)}
        onClick={handleMapClick}
        interactiveLayerIds={['route-lines-layer', 'checkpoint-markers-layer']}
        cursor="pointer"
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Map Controls */}
        <NavigationControl position="top-right" showCompass={false} />
        <FullscreenControl position="top-right" />
        <ScaleControl position="bottom-right" unit="imperial" />

        {/* Route Polylines Source & Layer */}
        <Source id="routes-source" type="geojson" data={routesGeoJson}>
          <Layer
            id="route-lines-layer"
            type="line"
            paint={{
              'line-color': ['get', 'color'],
              'line-width': ['get', 'lineWidth'],
              'line-opacity': ['get', 'lineOpacity'],
            }}
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
          />
        </Source>

        {/* Checkpoint Markers Source & Layers (GPU-accelerated circles) */}
        <Source id="checkpoints-source" type="geojson" data={checkpointsGeoJson}>
          {/* Subtle Outer Halo for visibility */}
          <Layer
            id="checkpoint-halo-layer"
            type="circle"
            paint={{
              'circle-radius': 8,
              'circle-color': '#000000',
              'circle-opacity': 0.4,
            }}
          />

          {/* Core Risk-Colored Checkpoint Circle */}
          <Layer
            id="checkpoint-markers-layer"
            type="circle"
            paint={{
              'circle-radius': 5.5,
              'circle-color': [
                'match',
                ['get', 'risk'],
                1,
                RISK_CONFIG[1].color,
                2,
                RISK_CONFIG[2].color,
                3,
                RISK_CONFIG[3].color,
                4,
                RISK_CONFIG[4].color,
                5,
                RISK_CONFIG[5].color,
                '#38bdf8', // fallback
              ],
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#ffffff',
              'circle-stroke-opacity': 0.9,
            }}
          />
        </Source>

        {/* Checkpoint Detail Popup */}
        {selectedCheckpoint && (
          <Popup
            longitude={Number(selectedCheckpoint.lon)}
            latitude={Number(selectedCheckpoint.lat)}
            anchor="bottom"
            onClose={() => setSelectedCheckpoint(null)}
            closeOnClick={false}
            offset={14}
          >
            <Paper
              sx={{
                p: 1.75,
                minWidth: 260,
                maxWidth: 320,
                bgcolor: '#111827',
                color: 'text.primary',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 2,
              }}
            >
              {/* Header */}
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Mile {selectedCheckpoint.mile?.toFixed(1)}
                </Typography>
                <RiskBadge level={Number(selectedCheckpoint.risk)} size="small" />
              </Stack>

              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                ETA: {formatDateTime(selectedCheckpoint.eta)} • {selectedCheckpoint.route_label}
              </Typography>

              {/* Weather Conditions Row */}
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  p: 1,
                  borderRadius: 1,
                  bgcolor: 'background.default',
                  border: '1px solid rgba(255,255,255,0.06)',
                  mb: 1.5,
                }}
              >
                <Box sx={{ flex: 1, textAlign: 'center' }}>
                  <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                    <AirIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {formatMph(selectedCheckpoint.wind_mph)}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                    Sustained
                  </Typography>
                </Box>

                <Box sx={{ flex: 1, textAlign: 'center' }}>
                  <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                    <WaterDropIcon sx={{ fontSize: 14, color: '#60a5fa' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {formatInHr(selectedCheckpoint.rain_in_hr)}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                    Rain+Shower
                  </Typography>
                </Box>

                <Box sx={{ flex: 1, textAlign: 'center' }}>
                  <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                    <AcUnitIcon sx={{ fontSize: 14, color: '#93c5fd' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {formatInHr(selectedCheckpoint.snow_in_hr)}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                    Snowfall
                  </Typography>
                </Box>
              </Stack>

              {/* Heavy Load Hazard Rule Applied Flag */}
              {selectedCheckpoint.load_rule_applied && (
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    mb: 1,
                  }}
                >
                  <WarningAmberIcon sx={{ fontSize: 16, flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.72rem', lineHeight: 1.3 }}>
                    <strong>Load Rule Applied:</strong> Risk elevated due to {loadWeightLb?.toLocaleString() || '40k+'} lb cargo weight.
                  </Typography>
                </Stack>
              )}

              {/* Drivers & Segment Length */}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  Drivers: <strong>{selectedCheckpoint.drivers || 'None'}</strong>
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  Segment: {selectedCheckpoint.segment_miles?.toFixed(1)} mi
                </Typography>
              </Stack>
            </Paper>
          </Popup>
        )}
      </Map>

      {/* Map Action Floating Buttons (Fit to bounds & Toggle legend) */}
      <Box sx={{ position: 'absolute', top: 16, right: 54, display: 'flex', gap: 1, zIndex: 10 }}>
        <Tooltip title="Fit camera to entire route corridor">
          <IconButton
            size="small"
            onClick={fitCorridor}
            sx={{
              bgcolor: 'rgba(17, 24, 39, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'text.primary',
              '&:hover': { bgcolor: 'rgba(30, 41, 59, 0.95)' },
            }}
          >
            <CenterFocusStrongIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={showLegend ? 'Hide map legend' : 'Show map legend'}>
          <IconButton
            size="small"
            onClick={() => setShowLegend(!showLegend)}
            sx={{
              bgcolor: 'rgba(17, 24, 39, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: showLegend ? 'primary.main' : 'text.primary',
              '&:hover': { bgcolor: 'rgba(30, 41, 59, 0.95)' },
            }}
          >
            <LayersIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Floating Interactive Map Legend */}
      {showLegend && (
        <Paper
          sx={{
            position: 'absolute',
            bottom: 24,
            left: 20,
            p: 1.5,
            bgcolor: 'rgba(17, 24, 39, 0.9)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 2,
            zIndex: 10,
            minWidth: 210,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: 'text.secondary',
              display: 'block',
              mb: 1,
            }}
          >
            Corridor Route Legend
          </Typography>

          {/* Route Lines */}
          <Stack spacing={0.75} sx={{ mb: 1.5 }}>
            {routes.map((r) => {
              const isSelected = r.id === selectedRouteId;
              const color = ROUTE_LINE_COLORS[r.id] || DEFAULT_ROUTE_COLOR;

              return (
                <Stack
                  key={r.id}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  onClick={() => onSelectRoute && onSelectRoute(r.id)}
                  sx={{
                    cursor: 'pointer',
                    opacity: isSelected ? 1 : 0.65,
                    '&:hover': { opacity: 1 },
                  }}
                >
                  <Box
                    sx={{
                      width: 18,
                      height: isSelected ? 4 : 2.5,
                      bgcolor: color,
                      borderRadius: 1,
                    }}
                  />
                  <Typography variant="caption" sx={{ fontWeight: isSelected ? 700 : 500 }}>
                    {r.label}
                  </Typography>
                  {r.is_recommended && (
                    <Chip label="Rec" size="small" color="success" sx={{ height: 16, fontSize: '0.625rem' }} />
                  )}
                </Stack>
              );
            })}
          </Stack>

          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: 'text.secondary',
              display: 'block',
              mb: 0.75,
            }}
          >
            Checkpoint Risk (ETA)
          </Typography>

          {/* Checkpoint Risk Tiers */}
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {Object.values(RISK_CONFIG).map((cfg) => (
              <Stack key={cfg.key} direction="row" spacing={0.5} alignItems="center" sx={{ mr: 0.75, mb: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cfg.color }} />
                <Typography variant="caption" sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                  {cfg.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Attribution Footer */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 4,
          right: 8,
          zIndex: 5,
          pointerEvents: 'none',
        }}
      >
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.625rem' }}>
          &copy; CARTO &copy; OpenStreetMap contributors
        </Typography>
      </Box>
    </Box>
  );
}

RouteMap.propTypes = {
  routes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      is_recommended: PropTypes.bool.isRequired,
      geometry: PropTypes.shape({
        type: PropTypes.string.isRequired,
        coordinates: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
      }).isRequired,
      checkpoints: PropTypes.arrayOf(PropTypes.object),
    })
  ),
  selectedRouteId: PropTypes.string,
  hoveredRouteId: PropTypes.string,
  onSelectRoute: PropTypes.func,
  loadWeightLb: PropTypes.number,
};
