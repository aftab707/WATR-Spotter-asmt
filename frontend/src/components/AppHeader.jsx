import { useState } from 'react';
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
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
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
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import TuneIcon from '@mui/icons-material/Tune';

import { useHealthCheck } from '../api/queries';

export default function AppHeader({
  activeTab = 'map',
  onTabChange,
  checkpointCount = 0,
  isDemoMode = false,
  onToggleDemoMode,
  onRefreshPlan,
  isSidebarCollapsed = false,
  onToggleSidebar,
  mobileTab = 'controls',
  onMobileTabChange,
}) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { data: health, isLoading, isError, refetch, isFetching } = useHealthCheck();

  const isOnline = !isError && health?.status === 'ok';

  return (
    <AppBar position="sticky" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#0b0f19' }}>
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: 60, px: { xs: 1.5, md: 2.5 } }}>
        {/* Left Branding & Mobile Drawer Trigger / Desktop Sidebar Collapse */}
        <Stack direction="row" alignItems="center" spacing={1}>
          {/* Mobile Hamburger Drawer Trigger */}
          <IconButton
            size="small"
            color="inherit"
            aria-label="Open mobile navigation menu"
            onClick={() => setMobileDrawerOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, mr: 0.5 }}
          >
            <MenuIcon sx={{ fontSize: 22 }} />
          </IconButton>

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

          {/* Desktop Sidebar Collapse / Expand Icon Button */}
          {onToggleSidebar && (
            <Tooltip title={isSidebarCollapsed ? 'Show trip & routes sidebar' : 'Collapse sidebar (Full map view)'}>
              <IconButton
                size="small"
                onClick={onToggleSidebar}
                sx={{
                  display: { xs: 'none', md: 'inline-flex' },
                  ml: 1.25,
                  color: isSidebarCollapsed ? 'text.secondary' : 'primary.main',
                  bgcolor: isSidebarCollapsed ? 'rgba(255,255,255,0.04)' : 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid',
                  borderColor: isSidebarCollapsed ? 'rgba(255,255,255,0.12)' : 'rgba(56, 189, 248, 0.35)',
                  p: 0.7,
                  transition: 'all 0.2s ease',
                  '&:hover': { bgcolor: 'rgba(56, 189, 248, 0.22)', borderColor: 'primary.main' },
                }}
                aria-label={isSidebarCollapsed ? 'Show sidebar' : 'Collapse sidebar'}
              >
                <ViewSidebarIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        {/* Center Primary View Navigation Tabs (Desktop >= md) */}
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
                label="Online"
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
              px: { xs: 1, sm: 1.25 },
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Refresh</Box>
          </Button>
        </Stack>
      </Toolbar>

      {/* Mobile Drawer Navigation (< md) */}
      <Drawer
        anchor="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            bgcolor: '#0e1320',
            borderRight: '1px solid rgba(255,255,255,0.1)',
            p: 2,
          },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                bgcolor: 'rgba(56, 189, 248, 0.15)',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LocalShippingIcon sx={{ fontSize: 18 }} />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              WATR
            </Typography>
          </Stack>
          <IconButton size="small" onClick={() => setMobileDrawerOpen(false)} aria-label="Close menu">
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>

        <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.08)' }} />

        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}>
          Views & Navigation
        </Typography>

        <List disablePadding sx={{ mb: 2 }}>
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={mobileTab === 'controls'}
              onClick={() => {
                if (onMobileTabChange) onMobileTabChange('controls');
                setMobileDrawerOpen(false);
              }}
              sx={{ borderRadius: 1.5, py: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: mobileTab === 'controls' ? 'primary.main' : 'text.secondary' }}>
                <TuneIcon sx={{ fontSize: 18 }} />
              </ListItemIcon>
              <ListItemText primary="Trip Setup & Form" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={activeTab === 'map' && mobileTab !== 'controls'}
              onClick={() => {
                if (onTabChange) onTabChange('map');
                if (onMobileTabChange) onMobileTabChange('map');
                setMobileDrawerOpen(false);
              }}
              sx={{ borderRadius: 1.5, py: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: activeTab === 'map' ? 'primary.main' : 'text.secondary' }}>
                <MapIcon sx={{ fontSize: 18 }} />
              </ListItemIcon>
              <ListItemText primary="Route Map & Forecast" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={activeTab === 'checkpoints'}
              onClick={() => {
                if (onTabChange) onTabChange('checkpoints');
                if (onMobileTabChange) onMobileTabChange('checkpoints');
                setMobileDrawerOpen(false);
              }}
              sx={{ borderRadius: 1.5, py: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: activeTab === 'checkpoints' ? 'primary.main' : 'text.secondary' }}>
                <TableRowsIcon sx={{ fontSize: 18 }} />
              </ListItemIcon>
              <ListItemText
                primary={`Checkpoints (${checkpointCount || 0})`}
                primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }}
              />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton
              selected={activeTab === 'compare'}
              onClick={() => {
                if (onTabChange) onTabChange('compare');
                if (onMobileTabChange) onMobileTabChange('compare');
                setMobileDrawerOpen(false);
              }}
              sx={{ borderRadius: 1.5, py: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: activeTab === 'compare' ? 'primary.main' : 'text.secondary' }}>
                <CompareArrowsIcon sx={{ fontSize: 18 }} />
              </ListItemIcon>
              <ListItemText primary="Compare Routes" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
            </ListItemButton>
          </ListItem>
        </List>

        <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.08)' }} />

        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}>
          Scenario Mode
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Chip
            icon={isDemoMode ? <BoltIcon sx={{ fontSize: '15px !important' }} /> : <CloudDoneIcon sx={{ fontSize: '15px !important' }} />}
            label={isDemoMode ? 'Severe Storm Scenario' : 'Live Real-Time API'}
            color={isDemoMode ? 'warning' : 'default'}
            variant={isDemoMode ? 'filled' : 'outlined'}
            onClick={() => {
              if (onToggleDemoMode) onToggleDemoMode();
              setMobileDrawerOpen(false);
            }}
            sx={{ fontWeight: 700, width: '100%', py: 1.5, height: 'auto', fontSize: '0.75rem', justifyContent: 'flex-start', px: 1.5 }}
          />
        </Box>
      </Drawer>
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
  isSidebarCollapsed: PropTypes.bool,
  onToggleSidebar: PropTypes.func,
  mobileTab: PropTypes.string,
  onMobileTabChange: PropTypes.func,
};
