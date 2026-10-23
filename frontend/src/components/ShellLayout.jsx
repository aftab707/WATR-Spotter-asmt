import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Tabs,
  Tab,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Button,
  Paper,
} from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import TableRowsIcon from '@mui/icons-material/TableRows';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import TuneIcon from '@mui/icons-material/Tune';

/**
 * Responsive Shell Layout for WATR.
 *
 * Per Step 14 & UI Polish:
 * - Desktop (>= 900px / md): Collapsible 430px sidebar with smooth CSS animation + full-width Map mode.
 * - Mobile (< 900px): Clean 4-view mobile tab switcher (Setup, Map, Checkpoints, Compare) + Hamburger Drawer.
 * - Accessibility, ARIA landmark roles, zero layout shift, seamless WebGL canvas resizing.
 */
export default function ShellLayout({
  header,
  leftPanel,
  mapArea,
  mainArea,
  bottomPanel = null,
  mobileTab: controlledMobileTab,
  onMobileTabChange,
  isSidebarCollapsed = false,
  onToggleSidebar,
  checkpointCount = 0,
}) {
  const [internalMobileTab, setInternalMobileTab] = useState('controls');

  const isControlled = controlledMobileTab !== undefined;
  const activeTab = isControlled ? controlledMobileTab : internalMobileTab;

  const handleTabChange = (_, val) => {
    if (!isControlled) {
      setInternalMobileTab(val);
    }
    if (onMobileTabChange) {
      onMobileTabChange(val);
    }
  };

  const centerContent = mainArea || mapArea;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      {/* Top Navigation */}
      {header}

      {/* Mobile / Narrow Screen Tab Switcher (< md) */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          zIndex: 4,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
          aria-label="Mobile navigation views"
          sx={{
            width: '100%',
            minHeight: 46,
            '& .MuiTab-root': {
              minHeight: 46,
              py: 0.5,
              px: 1,
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'none',
              gap: 0.5,
            },
          }}
        >
          <Tab
            value="controls"
            icon={<TuneIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label="Setup"
            id="mobile-tab-controls"
            aria-controls="mobile-panel-controls"
          />
          <Tab
            value="map"
            icon={<MapIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label="Map"
            id="mobile-tab-map"
            aria-controls="mobile-panel-map"
          />
          <Tab
            value="checkpoints"
            icon={<TableRowsIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={checkpointCount ? `Points (${checkpointCount})` : 'Points'}
            id="mobile-tab-checkpoints"
            aria-controls="mobile-panel-checkpoints"
          />
          <Tab
            value="compare"
            icon={<CompareArrowsIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label="Compare"
            id="mobile-tab-compare"
            aria-controls="mobile-panel-compare"
          />
        </Tabs>
      </Box>

      {/* Main Workspace Body */}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          flexDirection: { xs: 'column', md: 'row' },
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Left Control & Route Cards Panel (Collapsible on Desktop) */}
        <Box
          component="aside"
          id="mobile-panel-controls"
          role="region"
          aria-labelledby="mobile-tab-controls"
          sx={{
            width: {
              xs: '100%',
              md: isSidebarCollapsed ? 0 : 430,
              lg: isSidebarCollapsed ? 0 : 460,
            },
            minWidth: {
              xs: '100%',
              md: isSidebarCollapsed ? 0 : 430,
              lg: isSidebarCollapsed ? 0 : 460,
            },
            borderRight: { md: isSidebarCollapsed ? 0 : 1 },
            borderColor: 'divider',
            display: {
              xs: activeTab === 'controls' ? 'flex' : 'none',
              md: 'flex',
            },
            flexDirection: 'column',
            overflowY: 'auto',
            bgcolor: 'background.paper',
            zIndex: 2,
            transition: 'all 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: { md: isSidebarCollapsed ? 0 : 1 },
            visibility: {
              xs: activeTab === 'controls' ? 'visible' : 'hidden',
              md: isSidebarCollapsed ? 'hidden' : 'visible',
            },
            pointerEvents: { md: isSidebarCollapsed ? 'none' : 'auto' },
          }}
        >
          {/* Desktop Sidebar Header Bar with Collapse Button */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              display: { xs: 'none', md: 'flex' },
              px: 2,
              py: 1.25,
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              bgcolor: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <TuneIcon sx={{ fontSize: 17, color: 'primary.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.8rem', letterSpacing: 0.2 }}>
                Trip Planning &amp; Routes
              </Typography>
            </Stack>
            {onToggleSidebar && (
              <Tooltip title="Collapse sidebar (Full map view)">
                <IconButton
                  size="small"
                  onClick={onToggleSidebar}
                  sx={{
                    color: 'text.secondary',
                    p: 0.5,
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 1.5,
                    '&:hover': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.06)' },
                  }}
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeftIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          {leftPanel}
        </Box>

        {/* Center Canvas / Workspace Area */}
        <Box
          component="main"
          id="mobile-panel-main"
          role="region"
          aria-labelledby="mobile-tab-map"
          sx={{
            flex: 1,
            display: {
              xs: activeTab !== 'controls' ? 'flex' : 'none',
              md: 'flex',
            },
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            bgcolor: '#070a13',
          }}
        >
          {/* Floating Expand Sidebar Pill (Visible when sidebar collapsed on Desktop) */}
          {isSidebarCollapsed && (
            <Paper
              elevation={4}
              sx={{
                display: { xs: 'none', md: 'flex' },
                position: 'absolute',
                top: 16,
                left: 16,
                zIndex: 12,
                bgcolor: 'rgba(17, 24, 39, 0.94)',
                backdropFilter: 'blur(10px)',
                border: '1.5px solid rgba(56, 189, 248, 0.45)',
                borderRadius: 2,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
            >
              <Button
                startIcon={<ViewSidebarIcon sx={{ color: 'primary.main', fontSize: 17 }} />}
                endIcon={<ChevronRightIcon sx={{ fontSize: 16 }} />}
                onClick={onToggleSidebar}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  color: 'text.primary',
                  px: 1.75,
                  py: 0.65,
                }}
              >
                Trip &amp; Routes
              </Button>
            </Paper>
          )}

          {/* Main Area (Map, Checkpoints, or Compare) */}
          <Box
            sx={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {centerContent}
          </Box>

          {/* Optional Bottom Panel if explicitly provided */}
          {bottomPanel && (
            <Box
              component="section"
              sx={{
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                zIndex: 3,
              }}
            >
              {bottomPanel}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

ShellLayout.propTypes = {
  header: PropTypes.node.isRequired,
  leftPanel: PropTypes.node.isRequired,
  mapArea: PropTypes.node,
  mainArea: PropTypes.node,
  bottomPanel: PropTypes.node,
  mobileTab: PropTypes.string,
  onMobileTabChange: PropTypes.func,
  isSidebarCollapsed: PropTypes.bool,
  onToggleSidebar: PropTypes.func,
  checkpointCount: PropTypes.number,
};
