import { useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Typography,
  Stack,
  Slider,
  IconButton,
  Tooltip,
  Divider,
  Button,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import FastForwardIcon from '@mui/icons-material/FastForward';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import LayersIcon from '@mui/icons-material/Layers';
import LayersClearIcon from '@mui/icons-material/LayersClear';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import dayjs from 'dayjs';

import RiskBadge from './RiskBadge';
import { RISK_CONFIG } from '../lib/risk';

const SLIDER_MARKS = [
  { value: 0, label: '0h' },
  { value: 6, label: '+6h' },
  { value: 12, label: '+12h' },
  { value: 18, label: '+18h' },
  { value: 24, label: '+24h' },
  { value: 30, label: '+30h' },
  { value: 36, label: '+36h' },
  { value: 42, label: '+42h' },
  { value: 48, label: '+48h' },
];

/**
 * 0–48h Forecast Timeline Slider & Playback Controller.
 *
 * Per Step 12 & PROJECT_SPEC.md:
 * - Slider range: 0 to 48 hours post-departure with marks every 6 hours.
 * - Displays clock time (departure + h) in local user timezone.
 * - Play / Pause automated timeline playback.
 * - Throttles updates via requestAnimationFrame for 60fps responsiveness.
 * - 100% computed client-side from the pre-loaded series — zero network requests.
 * - Explicitly labels: "Area forecast at this time" vs "Weather at your ETA".
 */
export default function HeatmapSlider({
  sliderHour,
  onSliderChange,
  departureTime,
  isPlaying,
  onTogglePlay,
  showHeatmap,
  onToggleHeatmap,
}) {
  const rafRef = useRef(null);

  // Throttled slider change using requestAnimationFrame for zero-jank dragging
  const handleSliderChange = useCallback(
    (_, val) => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        onSliderChange(Number(val));
      });
    },
    [onSliderChange]
  );

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const departureDayjs = dayjs(departureTime);
  const currentSliderTime = departureDayjs.add(sliderHour, 'hour');

  // Format timezone abbreviation
  const tzAbbr =
    new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(currentSliderTime.toDate())
      .find((p) => p.type === 'timeZoneName')?.value || '';

  const formattedClockTime = `${currentSliderTime.format('ddd, MMM D • h:00 A')} ${tzAbbr}`;

  return (
    <Box sx={{ p: 2, px: { xs: 2, md: 3 } }}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={2.5}
        alignItems={{ xs: 'stretch', lg: 'center' }}
      >
        {/* Playback Controls & Timeline Clock */}
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ minWidth: { lg: 340 } }}
        >
          {/* Play/Pause Button */}
          <Tooltip title={isPlaying ? 'Pause timeline animation' : 'Play 48-hour forecast timeline'}>
            <IconButton
              color="primary"
              onClick={onTogglePlay}
              sx={{
                border: '1.5px solid',
                borderColor: 'primary.main',
                p: 1.1,
                bgcolor: isPlaying ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(56, 189, 248, 0.25)' },
              }}
            >
              {isPlaying ? <PauseIcon sx={{ fontSize: 20 }} /> : <PlayArrowIcon sx={{ fontSize: 20 }} />}
            </IconButton>
          </Tooltip>

          {/* Step Controls (-6h, +6h, Reset) */}
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Back 6 hours">
              <span>
                <IconButton
                  size="small"
                  onClick={() => onSliderChange(Math.max(0, sliderHour - 6))}
                  disabled={sliderHour === 0}
                  sx={{ color: 'text.secondary' }}
                >
                  <FastRewindIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Forward 6 hours">
              <span>
                <IconButton
                  size="small"
                  onClick={() => onSliderChange(Math.min(48, sliderHour + 6))}
                  disabled={sliderHour === 48}
                  sx={{ color: 'text.secondary' }}
                >
                  <FastForwardIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Reset to departure (0h)">
              <span>
                <IconButton
                  size="small"
                  onClick={() => onSliderChange(0)}
                  disabled={sliderHour === 0}
                  sx={{ color: 'text.secondary' }}
                >
                  <RestartAltIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />

          {/* Area Forecast Timestamp Label */}
          <Box sx={{ overflow: 'hidden' }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <AccessTimeIcon sx={{ fontSize: 15, color: 'primary.main' }} />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'primary.light',
                  letterSpacing: 0.5,
                  fontSize: '0.6875rem',
                }}
              >
                Area forecast at this time (+{sliderHour}h)
              </Typography>
            </Stack>

            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }} noWrap>
              {formattedClockTime}
            </Typography>
          </Box>
        </Stack>

        {/* 0–48h Timeline Slider */}
        <Box sx={{ flex: 1, px: 2, minWidth: { md: 240 } }}>
          <Slider
            value={sliderHour}
            min={0}
            max={48}
            step={1}
            marks={SLIDER_MARKS}
            onChange={handleSliderChange}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `+${v}h`}
            sx={{
              color: 'primary.main',
              py: 1,
              '& .MuiSlider-thumb': {
                width: 18,
                height: 18,
                boxShadow: '0 0 10px rgba(56, 189, 248, 0.6)',
                '&:hover, &.Mui-focusVisible': {
                  boxShadow: '0 0 0 8px rgba(56, 189, 248, 0.25)',
                },
              },
              '& .MuiSlider-markLabel': {
                fontSize: '0.6875rem',
                color: 'text.secondary',
                mt: 0.5,
              },
              '& .MuiSlider-mark': {
                height: 6,
                width: 2,
                bgcolor: 'rgba(255, 255, 255, 0.3)',
              },
            }}
          />
        </Box>

        <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', lg: 'block' } }} />

        {/* Heatmap Layer Toggle & Comparison Legend */}
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
          <Button
            size="small"
            variant={showHeatmap ? 'contained' : 'outlined'}
            color={showHeatmap ? 'primary' : 'inherit'}
            startIcon={showHeatmap ? <LayersIcon /> : <LayersClearIcon />}
            onClick={onToggleHeatmap}
            sx={{
              px: 1.5,
              py: 0.75,
              fontSize: '0.75rem',
              fontWeight: 700,
              borderColor: 'rgba(255,255,255,0.15)',
            }}
          >
            {showHeatmap ? 'Heatmap: On' : 'Heatmap: Off'}
          </Button>

          {/* Standard Palette Legend */}
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
            {Object.values(RISK_CONFIG).map((cfg) => (
              <RiskBadge key={cfg.key} level={cfg.level} size="small" />
            ))}
          </Stack>
        </Stack>
      </Stack>

      {/* Explanatory Distinction Subtitle */}
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          display: 'block',
          mt: 1,
          textAlign: { xs: 'left', lg: 'center' },
          fontSize: '0.7rem',
        }}
      >
        <strong>Note:</strong> Heatmap slider displays <strong>Area forecast at this time</strong> across the entire corridor. Route checkpoint cards display <strong>Weather at your ETA</strong> based on truck travel speed.
      </Typography>
    </Box>
  );
}

HeatmapSlider.propTypes = {
  sliderHour: PropTypes.number.isRequired,
  onSliderChange: PropTypes.func.isRequired,
  departureTime: PropTypes.string.isRequired,
  isPlaying: PropTypes.bool.isRequired,
  onTogglePlay: PropTypes.func.isRequired,
  showHeatmap: PropTypes.bool.isRequired,
  onToggleHeatmap: PropTypes.func.isRequired,
};
