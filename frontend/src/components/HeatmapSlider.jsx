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
  Chip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import FastForwardIcon from '@mui/icons-material/FastForward';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import LayersIcon from '@mui/icons-material/Layers';
import LayersClearIcon from '@mui/icons-material/LayersClear';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import dayjs from 'dayjs';

const SLIDER_MARKS = [
  { value: 0, label: '0h' },
  { value: 12, label: '+12h' },
  { value: 24, label: '+24h' },
  { value: 36, label: '+36h' },
  { value: 48, label: '+48h' },
];

/**
 * Modern Sleek Floating Forecast Timeline Controller.
 *
 * Designed as a compact, floating glass pill overlaying the bottom of the map.
 * Takes minimal vertical footprint while delivering 60fps throttled scrubbing.
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

  const handleSliderChange = useCallback(
    (_, val) => {
      if (typeof val !== 'number') return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        onSliderChange(val);
      });
    },
    [onSliderChange]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const baseDate = departureTime ? dayjs(departureTime) : dayjs();
  const currentTimelineDate = baseDate.add(sliderHour, 'hour');
  const formattedClock = currentTimelineDate.isValid()
    ? currentTimelineDate.format('MMM D, h:mm A')
    : `+${sliderHour}h`;

  return (
    <Box
      sx={{
        px: { xs: 1.5, sm: 2 },
        py: 1,
        bgcolor: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        borderRadius: 2.5,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
        width: '100%',
        maxWidth: 780,
      }}
    >
      <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }} alignItems="center">
        {/* Play / Pause Toggle Button */}
        <Tooltip title={isPlaying ? 'Pause animation' : 'Play 48h forecast'}>
          <IconButton
            size="small"
            color="primary"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}
            sx={{
              p: 0.75,
              bgcolor: isPlaying ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid',
              borderColor: isPlaying ? 'primary.main' : 'rgba(255, 255, 255, 0.15)',
              '&:hover': { bgcolor: 'rgba(56, 189, 248, 0.25)' },
            }}
          >
            {isPlaying ? <PauseIcon sx={{ fontSize: 18 }} /> : <PlayArrowIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>

        {/* Step Controls (-6h, +6h, Reset) */}
        <Stack direction="row" spacing={0.25}>
          <Tooltip title="Back 6 hours">
            <span>
              <IconButton
                size="small"
                onClick={() => onSliderChange(Math.max(0, sliderHour - 6))}
                disabled={sliderHour === 0}
                sx={{ color: 'text.secondary', p: 0.5 }}
                aria-label="Rewind 6 hours"
              >
                <FastRewindIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Forward 6 hours">
            <span>
              <IconButton
                size="small"
                onClick={() => onSliderChange(Math.min(48, sliderHour + 6))}
                disabled={sliderHour === 48}
                sx={{ color: 'text.secondary', p: 0.5 }}
                aria-label="Forward 6 hours"
              >
                <FastForwardIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Reset to 0h">
            <span>
              <IconButton
                size="small"
                onClick={() => onSliderChange(0)}
                disabled={sliderHour === 0}
                sx={{ color: 'text.secondary', p: 0.5 }}
                aria-label="Reset timeline"
              >
                <RestartAltIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Divider orientation="vertical" flexItem sx={{ my: 0.5, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

        {/* Clock Label */}
        <Box sx={{ minWidth: { xs: 90, sm: 130 } }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: 'primary.light',
              display: 'block',
              fontSize: '0.625rem',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            +{sliderHour}h Forecast
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}
          >
            {formattedClock}
          </Typography>
        </Box>

        {/* Timeline Slider */}
        <Box sx={{ flex: 1, px: 1 }}>
          <Slider
            value={sliderHour}
            min={0}
            max={48}
            step={1}
            marks={SLIDER_MARKS}
            onChange={handleSliderChange}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `+${v}h`}
            aria-label="0 to 48 hours forecast timeline slider"
            sx={{
              color: 'primary.main',
              py: 0.75,
              '& .MuiSlider-thumb': {
                width: 14,
                height: 14,
                boxShadow: '0 0 8px rgba(56, 189, 248, 0.7)',
                '&:hover, &.Mui-focusVisible': {
                  boxShadow: '0 0 0 6px rgba(56, 189, 248, 0.25)',
                },
              },
              '& .MuiSlider-markLabel': {
                fontSize: '0.625rem',
                color: 'text.secondary',
                top: 20,
              },
              '& .MuiSlider-mark': {
                height: 4,
                width: 2,
                bgcolor: 'rgba(255, 255, 255, 0.25)',
              },
              '& .MuiSlider-rail': {
                opacity: 0.2,
              },
            }}
          />
        </Box>

        {/* Heatmap Layer Toggle Chip */}
        <Chip
          icon={showHeatmap ? <LayersIcon sx={{ fontSize: '14px !important' }} /> : <LayersClearIcon sx={{ fontSize: '14px !important' }} />}
          label={showHeatmap ? 'Heatmap: On' : 'Off'}
          size="small"
          onClick={onToggleHeatmap}
          color={showHeatmap ? 'primary' : 'default'}
          variant={showHeatmap ? 'filled' : 'outlined'}
          sx={{
            height: 26,
            fontSize: '0.6875rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: '1px solid',
            borderColor: showHeatmap ? 'primary.main' : 'rgba(255, 255, 255, 0.2)',
          }}
        />

        {/* Distinction Info Tooltip */}
        <Tooltip
          title="Heatmap slider displays regional area forecast at +Xh across the corridor. Checkpoints show weather at the truck's arrival ETA."
          arrow
        >
          <IconButton size="small" sx={{ color: 'text.secondary', p: 0.5 }}>
            <InfoOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Stack>
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
