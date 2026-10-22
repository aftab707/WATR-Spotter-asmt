import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Alert,
  CircularProgress,
  InputAdornment,
  Paper,
  Tooltip,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import TripOriginIcon from '@mui/icons-material/TripOrigin';
import PlaceIcon from '@mui/icons-material/Place';
import ScaleIcon from '@mui/icons-material/Scale';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import NavigationIcon from '@mui/icons-material/Navigation';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import dayjs from 'dayjs';

import LocationAutocomplete from './LocationAutocomplete';

const LOAD_PRESETS = [
  { label: '25k lb (Light)', value: 25000 },
  { label: '35k lb (Rule >30k)', value: 35000 },
  { label: '42k lb (Rule >40k)', value: 42000 },
  { label: '80k lb (Max Standard)', value: 80000 },
];

export default function TripForm({ onSubmit, isSubmitting = false, serverError = null }) {
  const [origin, setOrigin] = useState({
    label: 'Chicago, IL, USA',
    lat: 41.8781,
    lon: -87.6298,
  });
  const [destination, setDestination] = useState({
    label: 'Denver, CO, USA',
    lat: 39.7392,
    lon: -104.9903,
  });
  const [departureTime, setDepartureTime] = useState(() => dayjs().add(2, 'hour'));
  const [loadWeight, setLoadWeight] = useState(42000);
  const [samplingInterval, setSamplingInterval] = useState(25);
  const [errors, setErrors] = useState({});

  // Minimum & maximum allowed departure bounds [now - 1h, now + 7 days]
  const minDateTime = dayjs().subtract(1, 'hour');
  const maxDateTime = dayjs().add(7, 'day');

  // "Try example trip" handler — pre-fills valid Chicago -> Denver trip in one click
  const handleTryExampleTrip = () => {
    setOrigin({
      label: 'Chicago, IL, USA',
      lat: 41.8781,
      lon: -87.6298,
    });
    setDestination({
      label: 'Denver, CO, USA',
      lat: 39.7392,
      lon: -104.9903,
    });
    setDepartureTime(dayjs().add(2, 'hour'));
    setLoadWeight(42000);
    setSamplingInterval(25);
    setErrors({});
  };

  const validate = () => {
    const newErrors = {};

    if (!origin) {
      newErrors.origin = 'Origin is required.';
    }

    if (!destination) {
      newErrors.destination = 'Destination is required.';
    } else if (
      origin &&
      Math.abs(origin.lat - destination.lat) < 0.001 &&
      Math.abs(origin.lon - destination.lon) < 0.001
    ) {
      newErrors.destination = 'Destination cannot be identical to origin.';
    }

    if (!departureTime || !departureTime.isValid()) {
      newErrors.departureTime = 'Valid departure date & time is required.';
    } else if (departureTime.isBefore(minDateTime)) {
      newErrors.departureTime = 'Departure cannot be in the past (min: now - 1h).';
    } else if (departureTime.isAfter(maxDateTime)) {
      newErrors.departureTime = 'Departure exceeds forecast horizon (max: 7 days).';
    }

    const weightNum = Number(loadWeight);
    if (!loadWeight || isNaN(weightNum)) {
      newErrors.loadWeight = 'Cargo load weight is required.';
    } else if (!Number.isInteger(weightNum)) {
      newErrors.loadWeight = 'Load weight must be a whole integer.';
    } else if (weightNum < 1) {
      newErrors.loadWeight = 'Minimum weight is 1 lb.';
    } else if (weightNum > 120000) {
      newErrors.loadWeight = 'Maximum legal truck weight is 120,000 lb.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      origin,
      destination,
      departure_time: departureTime.toISOString(),
      load_weight_lb: Number(loadWeight),
      sampling_interval_miles: Number(samplingInterval),
    });
  };

  return (
    <Paper
      component="form"
      onSubmit={handleSubmit}
      variant="outlined"
      sx={{
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
        bgcolor: 'background.paper',
        borderRadius: 2,
      }}
    >
      {/* Header with Example Trip Button */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Plan Route
        </Typography>

        <Button
          size="small"
          variant="outlined"
          color="secondary"
          startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
          onClick={handleTryExampleTrip}
          disabled={isSubmitting}
          sx={{
            py: 0.5,
            px: 1.25,
            fontSize: '0.75rem',
            borderColor: 'rgba(129, 140, 248, 0.4)',
            '&:hover': {
              borderColor: 'secondary.main',
              bgcolor: 'rgba(129, 140, 248, 0.08)',
            },
          }}
        >
          Try example trip
        </Button>
      </Stack>

      {/* Server Error Banner */}
      {serverError && (
        <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>
          {serverError}
        </Alert>
      )}

      {/* Origin Autocomplete */}
      <LocationAutocomplete
        id="trip-origin"
        label="Origin"
        placeholder="Search origin city..."
        value={origin}
        onChange={(val) => {
          setOrigin(val);
          if (errors.origin) setErrors((prev) => ({ ...prev, origin: null }));
        }}
        error={Boolean(errors.origin)}
        helperText={errors.origin}
        disabled={isSubmitting}
        required
        startIcon={<TripOriginIcon sx={{ fontSize: 18, color: 'primary.main' }} />}
      />

      {/* Destination Autocomplete */}
      <LocationAutocomplete
        id="trip-destination"
        label="Destination"
        placeholder="Search destination city..."
        value={destination}
        onChange={(val) => {
          setDestination(val);
          if (errors.destination) setErrors((prev) => ({ ...prev, destination: null }));
        }}
        error={Boolean(errors.destination)}
        helperText={errors.destination}
        disabled={isSubmitting}
        required
        startIcon={<PlaceIcon sx={{ fontSize: 18, color: 'error.main' }} />}
      />

      {/* Departure DateTimePicker */}
      <DateTimePicker
        label="Departure Time"
        value={departureTime}
        minDateTime={minDateTime}
        maxDateTime={maxDateTime}
        disabled={isSubmitting}
        onChange={(newVal) => {
          setDepartureTime(newVal);
          if (errors.departureTime) setErrors((prev) => ({ ...prev, departureTime: null }));
        }}
        slotProps={{
          textField: {
            size: 'small',
            fullWidth: true,
            error: Boolean(errors.departureTime),
            helperText:
              errors.departureTime ||
              'Forecast available up to 7 days from now (nearest-hour ETA matched).',
          },
        }}
      />

      {/* Load Weight Input & Quick Presets */}
      <Box>
        <TextField
          id="trip-load-weight"
          label="Gross Cargo Load Weight"
          type="number"
          size="small"
          fullWidth
          value={loadWeight}
          onChange={(e) => {
            setLoadWeight(e.target.value);
            if (errors.loadWeight) setErrors((prev) => ({ ...prev, loadWeight: null }));
          }}
          disabled={isSubmitting}
          error={Boolean(errors.loadWeight)}
          helperText={
            errors.loadWeight ||
            'Rules: >30,000 lb elevates 45–54 mph wind to No Travel; >40,000 lb elevates 35–44 mph to Severe.'
          }
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <ScaleIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: <InputAdornment position="end">lb</InputAdornment>,
            inputProps: { min: 1, max: 120000, step: 500 },
          }}
        />

        {/* Quick Weight Preset Chips */}
        <Stack direction="row" spacing={0.75} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
          {LOAD_PRESETS.map((preset) => (
            <Chip
              key={preset.value}
              label={preset.label}
              size="small"
              variant={loadWeight === preset.value ? 'filled' : 'outlined'}
              color={loadWeight === preset.value ? 'primary' : 'default'}
              onClick={() => {
                setLoadWeight(preset.value);
                if (errors.loadWeight) setErrors((prev) => ({ ...prev, loadWeight: null }));
              }}
              disabled={isSubmitting}
              sx={{ fontSize: '0.6875rem', height: 22 }}
            />
          ))}
        </Stack>
      </Box>

      {/* Sampling Interval Selector */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>
            Checkpoint Frequency
          </Typography>
          <Tooltip title="Sampling distance interval along corridor polylines">
            <Typography variant="caption" sx={{ color: 'primary.light', cursor: 'help' }}>
              {samplingInterval} mi intervals
            </Typography>
          </Tooltip>
        </Stack>

        <ToggleButtonGroup
          value={samplingInterval}
          exclusive
          onChange={(_, val) => {
            if (val !== null) setSamplingInterval(val);
          }}
          fullWidth
          size="small"
          disabled={isSubmitting}
          sx={{
            '& .MuiToggleButton-root': {
              py: 0.75,
              fontSize: '0.8125rem',
              fontWeight: 600,
              textTransform: 'none',
              borderColor: 'rgba(255,255,255,0.1)',
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  bgcolor: 'primary.light',
                },
              },
            },
          }}
        >
          <ToggleButton value={10}>10 mi (Detailed)</ToggleButton>
          <ToggleButton value={25}>25 mi (Standard)</ToggleButton>
          <ToggleButton value={50}>50 mi (Fast)</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Load Hazard Warning Note */}
      {Number(loadWeight) > 40000 && (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            p: 1.25,
            borderRadius: 1,
            bgcolor: 'rgba(249, 115, 22, 0.1)',
            border: '1px solid rgba(249, 115, 22, 0.3)',
            color: 'warning.light',
          }}
        >
          <WarningAmberIcon sx={{ fontSize: 18, color: '#f97316', flexShrink: 0 }} />
          <Typography variant="caption" sx={{ fontSize: '0.75rem', lineHeight: 1.3 }}>
            Heavy load active ({Number(loadWeight).toLocaleString()} lb). Winds between 35–44 mph will trigger <strong>Severe Risk</strong> roll-over classification.
          </Typography>
        </Stack>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        variant="contained"
        color="primary"
        size="large"
        disabled={isSubmitting}
        startIcon={
          isSubmitting ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            <NavigationIcon sx={{ fontSize: 18 }} />
          )
        }
        sx={{
          mt: 0.5,
          py: 1.2,
          fontWeight: 700,
          letterSpacing: 0.3,
          fontSize: '0.9375rem',
        }}
      >
        {isSubmitting ? 'Calculating Safe Routes...' : 'Calculate Safe Routes'}
      </Button>

      {/* Loading Helper / Cold-Start Subtext */}
      {isSubmitting && (
        <Typography
          variant="caption"
          align="center"
          sx={{ color: 'text.secondary', fontSize: '0.75rem', mt: -0.5 }}
        >
          Corridor routing & weather sampling in progress... (Free-tier instances may take ~15–20s to wake up on first call)
        </Typography>
      )}
    </Paper>
  );
}

TripForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
  serverError: PropTypes.string,
};
