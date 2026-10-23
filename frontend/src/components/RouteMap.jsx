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
import LayersClearIcon from '@mui/icons-material/LayersClear';
import AirIcon from '@mui/icons-material/Air';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import dayjs from 'dayjs';

import RiskBadge from './RiskBadge';
import { formatMph, formatInHr, formatDateTime } from '../lib/formatters';
import { RISK_CONFIG } from '../lib/risk';

// World-Class Esri Dark Gray Canvas Basemap (100% Free, Zero API Key Required, Fast & High Contrast)
const DARK_MAP_STYLE = {
  version: 8,
  sources: {
    'esri-dark-base': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '&copy; Esri, DeLorme, NAVTEQ, TomTom, OpenStreetMap',
    },
    'esri-dark-ref': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'esri-dark-base-layer',
      type: 'raster',
      source: 'esri-dark-base',
      minzoom: 0,
      maxzoom: 18,
    },
    {
      id: 'esri-dark-ref-layer',
      type: 'raster',
      source: 'esri-dark-ref',
      minzoom: 0,
      maxzoom: 18,
    },
  ],
};

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
  heatmap = null,
  sliderHour = 0,
  showHeatmap = true,
  onToggleHeatmap,
  departureTime,
  focusedCheckpoint = null,
  activeTab = 'map',
}) {
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState(null);
  const [selectedAreaPoint, setSelectedAreaPoint] = useState(null);
  const [showLegend, setShowLegend] = useState(true);

  const activeRoute = useMemo(() => {
    return routes.find((r) => r.id === (hoveredRouteId || selectedRouteId)) || routes[0] || null;
  }, [routes, hoveredRouteId, selectedRouteId]);

  // Trigger resize when activeTab switches to 'map'
  useEffect(() => {
    if (activeTab === 'map' && mapRef.current) {
      try {
        const map = mapRef.current.getMap ? mapRef.current.getMap() : mapRef.current;
        map?.resize();
      } catch (err) {
        // silent
      }
    }
  }, [activeTab]);

  // Focus map camera on checkpoint when selected from table or risk strip
  useEffect(() => {
    if (!focusedCheckpoint) return;

    setSelectedCheckpoint({
      ...focusedCheckpoint,
      lon: Number(focusedCheckpoint.lon),
      lat: Number(focusedCheckpoint.lat),
      mile: Number(focusedCheckpoint.mile),
      risk: Number(focusedCheckpoint.risk),
      route_label: activeRoute?.label || 'Route',
    });

    if (mapRef.current) {
      try {
        const map = mapRef.current.getMap ? mapRef.current.getMap() : mapRef.current;
        map?.resize();
        map?.flyTo({
          center: [Number(focusedCheckpoint.lon), Number(focusedCheckpoint.lat)],
          zoom: 6.2,
          duration: 800,
        });
      } catch (err) {
        // silent
      }
    }
  }, [focusedCheckpoint, activeRoute]);

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

  // GeoJSON FeatureCollection for checkpoints of ALL candidate routes
  const checkpointsGeoJson = useMemo(() => {
    if (!routes || routes.length === 0) {
      return { type: 'FeatureCollection', features: [] };
    }

    const features = [];

    // 1. Inactive routes checkpoints first (so active route dots render on top)
    routes.forEach((r) => {
      if (r.id !== activeRoute?.id && Array.isArray(r.checkpoints)) {
        r.checkpoints.forEach((cp) => {
          features.push({
            type: 'Feature',
            id: `${r.id}-cp-${cp.index}`,
            geometry: {
              type: 'Point',
              coordinates: [Number(cp.lon), Number(cp.lat)],
            },
            properties: {
              index: cp.index,
              mile: Number(cp.mile),
              lat: Number(cp.lat),
              lon: Number(cp.lon),
              eta: cp.eta,
              risk: Number(cp.risk || 1),
              risk_label: cp.risk_label || 'LOW',
              wind_mph: Number(cp.wind_mph || 0),
              rain_in_hr: Number(cp.rain_in_hr || 0),
              snow_in_hr: Number(cp.snow_in_hr || 0),
              drivers: Array.isArray(cp.drivers) ? cp.drivers.join(', ') : '',
              load_rule_applied: Boolean(cp.load_rule_applied),
              segment_miles: Number(cp.segment_miles || 25),
              route_id: r.id,
              route_label: r.label,
              is_active_route: false,
            },
          });
        });
      }
    });

    // 2. Active route checkpoints (fully prominent)
    if (activeRoute && Array.isArray(activeRoute.checkpoints)) {
      activeRoute.checkpoints.forEach((cp) => {
        features.push({
          type: 'Feature',
          id: `${activeRoute.id}-cp-${cp.index}`,
          geometry: {
            type: 'Point',
            coordinates: [Number(cp.lon), Number(cp.lat)],
          },
          properties: {
            index: cp.index,
            mile: Number(cp.mile),
            lat: Number(cp.lat),
            lon: Number(cp.lon),
            eta: cp.eta,
            risk: Number(cp.risk || 1),
            risk_label: cp.risk_label || 'LOW',
            wind_mph: Number(cp.wind_mph || 0),
            rain_in_hr: Number(cp.rain_in_hr || 0),
            snow_in_hr: Number(cp.snow_in_hr || 0),
            drivers: Array.isArray(cp.drivers) ? cp.drivers.join(', ') : '',
            load_rule_applied: Boolean(cp.load_rule_applied),
            segment_miles: Number(cp.segment_miles || 25),
            route_id: activeRoute.id,
            route_label: activeRoute.label,
            is_active_route: true,
          },
        });
      });
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [routes, activeRoute]);

  // GeoJSON FeatureCollection for 0–48h Heatmap Points at sliderHour (Area Forecast)
  // Computed 100% client-side from the pre-loaded series — zero network requests
  const heatmapGeoJson = useMemo(() => {
    if (!heatmap?.points || !showHeatmap) {
      return { type: 'FeatureCollection', features: [] };
    }

    const currentHourIndex = Math.min(48, Math.max(0, Math.round(sliderHour)));

    return {
      type: 'FeatureCollection',
      features: heatmap.points.map((pt, idx) => {
        const riskVal = pt.risk ? pt.risk[currentHourIndex] || 1 : 1;
        // Normalize weight for MapLibre heatmap shader (0.1 for Low up to 1.0 for No Travel)
        const weight = Math.max(0.12, (riskVal - 1) / 4);

        return {
          type: 'Feature',
          id: `hm-${idx}`,
          geometry: {
            type: 'Point',
            coordinates: [pt.lon, pt.lat],
          },
          properties: {
            index: idx,
            lat: pt.lat,
            lon: pt.lon,
            risk: riskVal,
            weight: weight,
            route_ids: pt.route_ids || [],
            hour_offset: currentHourIndex,
          },
        };
      }),
    };
  }, [heatmap, sliderHour, showHeatmap]);

  // Handle clicks on map layers
  const handleMapClick = (event) => {
    const features = event.features || [];

    // 1. Checkpoint circle clicked (Truck ETA)
    const checkpointFeature = features.find(
      (f) =>
        f.layer.id === 'checkpoint-markers-layer' ||
        f.layer.id === 'checkpoint-hitbox-layer' ||
        f.layer.id === 'checkpoint-halo-layer'
    );
    if (checkpointFeature) {
      const [lon, lat] = checkpointFeature.geometry.coordinates;
      const clickedRouteId = checkpointFeature.properties.route_id;
      if (clickedRouteId && onSelectRoute && clickedRouteId !== activeRoute?.id) {
        onSelectRoute(clickedRouteId);
      }
      setSelectedCheckpoint({
        ...checkpointFeature.properties,
        lon,
        lat,
      });
      setSelectedAreaPoint(null);
      return;
    }

    // 2. Area forecast point clicked (Heatmap corridor point at sliderHour)
    const areaPointFeature = features.find(
      (f) =>
        f.layer.id === 'corridor-slider-points-layer' ||
        f.layer.id === 'corridor-slider-hitbox-layer'
    );
    if (areaPointFeature) {
      const [lon, lat] = areaPointFeature.geometry.coordinates;
      setSelectedAreaPoint({
        ...areaPointFeature.properties,
        lon,
        lat,
      });
      setSelectedCheckpoint(null);
      return;
    }

    // 3. Route polyline clicked
    const routeFeature = features.find((f) => f.layer.id === 'route-lines-layer');
    if (routeFeature) {
      const clickedRouteId = routeFeature.properties.id;
      if (onSelectRoute && clickedRouteId) {
        onSelectRoute(clickedRouteId);
      }
      return;
    }

    // Dismiss popups when clicking blank area
    setSelectedCheckpoint(null);
    setSelectedAreaPoint(null);
  };

  const sliderTimeFormatted = useMemo(() => {
    if (!departureTime) return '';
    const d = dayjs(departureTime).add(sliderHour, 'hour');
    return d.format('MMM D, h:00 A');
  }, [departureTime, sliderHour]);

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: -96.0,
          latitude: 40.5,
          zoom: 4.5,
        }}
        mapStyle={DARK_MAP_STYLE}
        onLoad={() => setMapLoaded(true)}
        onClick={handleMapClick}
        interactiveLayerIds={[
          'route-lines-layer',
          'checkpoint-markers-layer',
          'checkpoint-hitbox-layer',
          'checkpoint-halo-layer',
          'corridor-slider-points-layer',
          'corridor-slider-hitbox-layer',
        ]}
        cursor="pointer"
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Map Controls */}
        <NavigationControl position="top-right" showCompass={false} />
        <FullscreenControl position="top-right" />
        <ScaleControl position="bottom-right" unit="imperial" />

        {/* 0–48h Dynamic Weather Heatmap Layer (Step 12) */}
        {showHeatmap && (
          <Source id="heatmap-source" type="geojson" data={heatmapGeoJson}>
            <Layer
              id="corridor-heatmap-layer"
              type="heatmap"
              paint={{
                'heatmap-weight': ['get', 'weight'],
                'heatmap-intensity': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  3,
                  0.7,
                  7,
                  1.6,
                  10,
                  2.8,
                ],
                'heatmap-color': [
                  'interpolate',
                  ['linear'],
                  ['heatmap-density'],
                  0,
                  'rgba(0, 0, 0, 0)',
                  0.18,
                  'rgba(34, 197, 94, 0.45)', // Low (Green)
                  0.38,
                  'rgba(234, 179, 8, 0.65)', // Moderate (Yellow)
                  0.62,
                  'rgba(249, 115, 22, 0.8)', // High (Orange)
                  0.82,
                  'rgba(239, 68, 68, 0.9)', // Severe (Red)
                  1.0,
                  'rgba(168, 85, 247, 0.98)', // No Travel (Purple)
                ],
                'heatmap-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  3,
                  15,
                  6,
                  28,
                  9,
                  45,
                ],
                'heatmap-opacity': 0.72,
              }}
            />

            {/* Corridor Point Markers at sliderHour (Area Forecast) - Crisp White Dots with Risk Rings */}
            <Layer
              id="corridor-slider-points-layer"
              type="circle"
              paint={{
                'circle-radius': 5,
                'circle-color': '#ffffff',
                'circle-opacity': 0.95,
                'circle-stroke-width': 2.5,
                'circle-stroke-color': [
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
                  '#38bdf8',
                ],
                'circle-stroke-opacity': 0.95,
              }}
            />

            {/* Transparent Hitbox Layer for easy clicking of area forecast points */}
            <Layer
              id="corridor-slider-hitbox-layer"
              type="circle"
              paint={{
                'circle-radius': 14,
                'circle-opacity': 0,
              }}
            />
          </Source>
        )}

        {/* Route Polylines Source & Layers (Dark casing + glowing core) */}
        <Source id="routes-source" type="geojson" data={routesGeoJson}>
          <Layer
            id="route-lines-casing-layer"
            type="line"
            paint={{
              'line-color': '#000000',
              'line-width': ['+', ['get', 'lineWidth'], 3.5],
              'line-opacity': 0.85,
            }}
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
          />
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

        {/* Checkpoint Markers Source & Layers (Truck ETA) - Hyper-Visible White Dots with Risk Rings */}
        <Source id="checkpoints-source" type="geojson" data={checkpointsGeoJson}>
          {/* Subtle Outer Halo for visibility */}
          <Layer
            id="checkpoint-halo-layer"
            type="circle"
            paint={{
              'circle-radius': ['case', ['get', 'is_active_route'], 9.5, 6],
              'circle-color': '#000000',
              'circle-opacity': 0.8,
            }}
          />

          {/* Core White Checkpoint Circle with Risk-Colored Ring */}
          <Layer
            id="checkpoint-markers-layer"
            type="circle"
            paint={{
              'circle-radius': ['case', ['get', 'is_active_route'], 6.5, 4],
              'circle-color': '#ffffff', // PURE WHITE DOT!
              'circle-opacity': ['case', ['get', 'is_active_route'], 1.0, 0.8],
              'circle-stroke-width': ['case', ['get', 'is_active_route'], 3, 1.5],
              'circle-stroke-color': [
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
              'circle-stroke-opacity': 1.0,
            }}
          />

          {/* Transparent Hitbox Layer for effortless, high-accuracy clicking */}
          <Layer
            id="checkpoint-hitbox-layer"
            type="circle"
            paint={{
              'circle-radius': 18,
              'circle-opacity': 0,
            }}
          />
        </Source>

        {/* Checkpoint Detail Popup (Truck's ETA) */}
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
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Mile {selectedCheckpoint.mile?.toFixed(1)}
                </Typography>
                <RiskBadge level={Number(selectedCheckpoint.risk)} size="small" />
              </Stack>

              <Chip
                label="Weather at Truck ETA"
                size="small"
                variant="outlined"
                color="primary"
                sx={{ height: 18, fontSize: '0.625rem', mb: 1, fontWeight: 700 }}
              />

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

        {/* Area Forecast Detail Popup (Heatmap Slider Hour) */}
        {selectedAreaPoint && (
          <Popup
            longitude={Number(selectedAreaPoint.lon)}
            latitude={Number(selectedAreaPoint.lat)}
            anchor="bottom"
            onClose={() => setSelectedAreaPoint(null)}
            closeOnClick={false}
            offset={12}
          >
            <Paper
              sx={{
                p: 1.75,
                minWidth: 240,
                maxWidth: 300,
                bgcolor: '#111827',
                color: 'text.primary',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: 2,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Area Weather Forecast
                </Typography>
                <RiskBadge level={Number(selectedAreaPoint.risk)} size="small" />
              </Stack>

              <Chip
                icon={<AccessTimeIcon sx={{ fontSize: '13px !important' }} />}
                label={`+{sliderHour}h Post Departure`}
                size="small"
                variant="outlined"
                color="secondary"
                sx={{ height: 20, fontSize: '0.65rem', mb: 1, fontWeight: 700 }}
              />

              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                Forecast Time: <strong>{sliderTimeFormatted}</strong>
              </Typography>

              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                Location: {Number(selectedAreaPoint.lat).toFixed(2)}°, {Number(selectedAreaPoint.lon).toFixed(2)}°
              </Typography>
            </Paper>
          </Popup>
        )}
      </Map>

      {/* Map Action Floating Buttons (Fit to bounds & Toggle Heatmap & Toggle Legend) */}
      <Box sx={{ position: 'absolute', top: 16, right: 54, display: 'flex', gap: 1, zIndex: 10 }}>
        {/* Toggle Heatmap Button */}
        <Tooltip title={showHeatmap ? 'Hide 0–48h Heatmap layer' : 'Show 0–48h Heatmap layer'}>
          <IconButton
            size="small"
            onClick={onToggleHeatmap}
            sx={{
              bgcolor: 'rgba(17, 24, 39, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: showHeatmap ? 'primary.main' : 'text.disabled',
              '&:hover': { bgcolor: 'rgba(30, 41, 59, 0.95)' },
            }}
          >
            {showHeatmap ? <LayersIcon sx={{ fontSize: 18 }} /> : <LayersClearIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>

        {/* Fit to Corridor Button */}
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

        {/* Legend Visibility Button */}
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
            bottom: { xs: 85, sm: 100, md: 110 },
            left: { xs: 8, sm: 14 },
            p: 1.25,
            bgcolor: 'rgba(17, 24, 39, 0.94)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 1.5,
            zIndex: 10,
            width: { xs: 190, sm: 220 },
            maxHeight: 'calc(100% - 130px)',
            overflowY: 'auto',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          {/* Header */}
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: 'text.secondary',
              display: 'block',
              fontSize: '0.625rem',
              mb: 0.75,
            }}
          >
            Map Legend &amp; Distinction
          </Typography>

          {/* Route Alternatives Section */}
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              display: 'block',
              fontSize: '0.65rem',
              mb: 0.4,
            }}
          >
            Route Lines
          </Typography>

          <Stack spacing={0.4} sx={{ mb: 1 }}>
            {routes.map((r) => {
              const isSelected = r.id === selectedRouteId;
              const color = ROUTE_LINE_COLORS[r.id] || DEFAULT_ROUTE_COLOR;

              return (
                <Stack
                  key={r.id}
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  onClick={() => onSelectRoute && onSelectRoute(r.id)}
                  sx={{
                    cursor: 'pointer',
                    opacity: isSelected ? 1 : 0.7,
                    '&:hover': { opacity: 1 },
                  }}
                >
                  <Box
                    sx={{
                      width: 14,
                      height: isSelected ? 3.5 : 2,
                      bgcolor: color,
                      borderRadius: 1,
                    }}
                  />
                  <Typography variant="caption" sx={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.65rem' }} noWrap>
                    {r.label}
                  </Typography>
                  {r.is_recommended && (
                    <Chip label="Rec" size="small" color="success" sx={{ height: 14, fontSize: '0.575rem', px: 0.4, '& .MuiChip-label': { px: 0.5 } }} />
                  )}
                </Stack>
              );
            })}
          </Stack>

          {/* Distinction: Area Heatmap vs Checkpoints */}
          <Box
            sx={{
              p: 0.75,
              borderRadius: 1,
              bgcolor: 'background.default',
              border: '1px solid rgba(255,255,255,0.06)',
              mb: 1,
            }}
          >
            <Stack spacing={0.35}>
              <Stack direction="row" spacing={0.65} alignItems="center">
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', border: '1.5px solid #38bdf8', flexShrink: 0 }} />
                <Typography variant="caption" sx={{ fontSize: '0.625rem', color: 'primary.light', lineHeight: 1.2 }}>
                  <strong>Heatmap:</strong> Area forecast (+{sliderHour}h)
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.65} alignItems="center">
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#ffffff', border: '1.5px solid #22c55e', flexShrink: 0 }} />
                <Typography variant="caption" sx={{ fontSize: '0.625rem', color: 'text.secondary', lineHeight: 1.2 }}>
                  <strong>Checkpoints:</strong> White dots with risk ring (Truck ETA)
                </Typography>
              </Stack>
            </Stack>
          </Box>

          {/* Checkpoint Risk Tiers */}
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              display: 'block',
              fontSize: '0.65rem',
              mb: 0.4,
            }}
          >
            Risk Tiers
          </Typography>

          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {Object.values(RISK_CONFIG).map((cfg) => (
              <Stack key={cfg.key} direction="row" spacing={0.4} alignItems="center" sx={{ mr: 0.5, mb: 0.35 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cfg.color, flexShrink: 0 }} />
                <Typography variant="caption" sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
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
  heatmap: PropTypes.shape({
    hours: PropTypes.arrayOf(PropTypes.number),
    points: PropTypes.arrayOf(
      PropTypes.shape({
        lat: PropTypes.number.isRequired,
        lon: PropTypes.number.isRequired,
        route_ids: PropTypes.arrayOf(PropTypes.string),
        risk: PropTypes.arrayOf(PropTypes.number),
      })
    ),
  }),
  sliderHour: PropTypes.number,
  showHeatmap: PropTypes.bool,
  onToggleHeatmap: PropTypes.func,
  departureTime: PropTypes.string,
  focusedCheckpoint: PropTypes.shape({
    lat: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    lon: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  activeTab: PropTypes.string,
};
