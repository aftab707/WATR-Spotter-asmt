import PropTypes from 'prop-types';
import {
  AppBar,
  Toolbar,
  Typography,
  Stack,
  Chip,
  Button,
  Box,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import MapIcon from '@mui/icons-material/Map';
import TableRowsIcon from '@mui/icons-material/TableRows';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import BoltIcon from '@mui/icons-material/Bolt';
import { useHealthCheck } from '../api/queries';

export default function AppHeader({
  activeTab = 'map',
  onTabChange,
  checkpointCount = 0,
  isDemoMode = false,
  onToggleDemoMode,
  onRefreshPlan,
}) {
  const { data: health, isLoading, isError, refetch, isFetching } = useHealthCheck();

  const isOnline = !isError && health?.status === 'ok';

  return (
    <AppBar position="sticky" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#0b0f19' }}>
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: 60, px: { xs: 1.5, md: 2.5 } }}>
        {/* Left Branding */}
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 1.5,
              bgcolor: 'rgba(56, 189, 248, 0.12)',
              color: 'primary.main',
              border: '1px solid rgba(56, 189, 248, 0.25)',
            }}
          >
            <LocalShippingIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" component="h1" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              WATR
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' }, fontSize: '0.6875rem' }}>
              Weather-Aware Truck Routing
            </Typography>
          </Box>
        </Stack>

        {/* Center Primary View Navigation Tabs */}
        <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
          <Tabs
            value={activeTab}
            onChange={(_, val) => onTabChange && onTabChange(val)}
            textColor="primary"
            indicatorColor="primary"
            aria-label="Application view tabs"
            sx={{
              minHeight: 48,
              '& .MuiTab-root': {
                minHeight: 48,
                py: 0.5,
                px: 2,
                fontSize: '0.8125rem',
                fontWeight: 600,
                textTransform: 'none',
                gap: 0.75,
              },
            }}
          >
            <Tab
              value="map"
              icon={<MapIcon sx={{ fontSize: 17 }} />}
              iconPosition="start"
              label="Route Map & Forecast"
            />
            <Tab
              value="checkpoints"
              icon={<TableRowsIcon sx={{ fontSize: 17 }} />}
              iconPosition="start"
              label={`Checkpoints (${checkpointCount || 0})`}
            />
            <Tab
              value="compare"
              icon={<CompareArrowsIcon sx={{ fontSize: 17 }} />}
              iconPosition="start"
              label="Compare Routes"
            />
          </Tabs>
        </Box>

        {/* Right Actions & Health Status */}
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Demo Scenario vs Live API Switch */}
          <Tooltip
            title={
              isDemoMode
                ? 'Viewing Severe Storm Scenario (Chicago → Denver blizzard). Click to switch to Live API.'
                : 'Click to load the benchmark Severe Storm Scenario (Chicago → Denver blizzard).'
            }
          >
            <Chip
              icon={isDemoMode ? <BoltIcon sx={{ fontSize: '15px !important' }} /> : <CloudDoneIcon sx={{ fontSize: '15px !important' }} />}
              label={isDemoMode ? 'Storm Demo' : 'Live API'}
              size="small"
              color={isDemoMode ? 'warning' : 'default'}
              variant={isDemoMode ? 'filled' : 'outlined'}
              onClick={onToggleDemoMode}
              sx={{
                fontWeight: 700,
                cursor: 'pointer',
                height: 26,
                fontSize: '0.6875rem',
                borderColor: isDemoMode ? 'warning.main' : 'rgba(255,255,255,0.18)',
              }}
            />
          </Tooltip>

          {/* Backend Health Status Badge */}
          {isLoading || isFetching ? (
            <Tooltip title="Checking backend API connectivity...">
              <Chip
                icon={<HourglassEmptyIcon sx={{ fontSize: 15 }} />}
                label="Checking..."
                size="small"
                variant="outlined"
                sx={{ borderColor: 'rgba(255,255,255,0.15)', height: 26, fontSize: '0.6875rem' }}
              />
            </Tooltip>
          ) : isOnline ? (
            <Tooltip title="Backend REST API is online and responding normally">
              <Chip
                icon={<CheckCircleOutlineIcon sx={{ fontSize: 15 }} />}
                label="Backend: Online"
                color="success"
                size="small"
                variant="outlined"
                sx={{ fontWeight: 600, height: 26, fontSize: '0.6875rem', display: { xs: 'none', sm: 'inline-flex' } }}
              />
            </Tooltip>
          ) : (
            <Tooltip title="Free-tier backend spinning up from sleep (may take 15–30s on first request). Click Refresh to retry.">
              <Chip
                icon={<ErrorOutlineIcon sx={{ fontSize: 15 }} />}
                label="Server waking up…"
                color="warning"
                size="small"
                variant="outlined"
                sx={{ fontWeight: 600, height: 26, fontSize: '0.6875rem' }}
              />
            </Tooltip>
          )}

          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon sx={{ fontSize: 15 }} />}
            onClick={() => {
              refetch();
              if (onRefreshPlan) onRefreshPlan();
            }}
            disabled={isFetching}
            aria-label="Refresh trip calculations and backend connectivity"
            sx={{
              borderColor: 'rgba(255,255,255,0.15)',
              color: 'text.primary',
              height: 28,
              fontSize: '0.75rem',
              px: 1.25,
            }}
          >
            Refresh
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

AppHeader.propTypes = {
  activeTab: PropTypes.string,
  onTabChange: PropTypes.func,
  checkpointCount: PropTypes.number,
  isDemoMode: PropTypes.bool,
  onToggleDemoMode: PropTypes.func,
  onRefreshPlan: PropTypes.func,
};
