import { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Tabs, Tab } from '@mui/material';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import MapIcon from '@mui/icons-material/Map';

/**
 * Responsive Shell Layout for WATR.
 *
 * Per Step 14 & Section 8 UI/UX Quality Bar:
 * - Desktop (>= 900px / md): Simultaneous 3-panel split (Left Controls/Cards, Map Canvas, Bottom Drawer).
 * - Mobile / Narrow screens (< 900px): Clean mobile tab switcher toggling between "Routes & Setup" and "Map & Weather".
 * - Seamless accessibility, ARIA landmark roles, focus rings, zero layout shift.
 */
export default function ShellLayout({
  header,
  leftPanel,
  mapArea,
  bottomPanel,
  mobileTab: controlledMobileTab,
  onMobileTabChange,
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
            minHeight: 44,
            '& .MuiTab-root': {
              minHeight: 44,
              py: 0.5,
              fontSize: '0.8125rem',
              fontWeight: 600,
              textTransform: 'none',
            },
          }}
        >
          <Tab
            value="controls"
            icon={<AltRouteIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Routes & Setup"
            id="mobile-tab-controls"
            aria-controls="mobile-panel-controls"
          />
          <Tab
            value="map"
            icon={<MapIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Map & Weather"
            id="mobile-tab-map"
            aria-controls="mobile-panel-map"
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
        {/* Left Control & Route Cards Panel */}
        <Box
          component="aside"
          id="mobile-panel-controls"
          role="region"
          aria-labelledby="mobile-tab-controls"
          sx={{
            width: { xs: '100%', md: 430, lg: 460 },
            borderRight: { md: 1 },
            borderColor: 'divider',
            display: {
              xs: activeTab === 'controls' ? 'flex' : 'none',
              md: 'flex',
            },
            flexDirection: 'column',
            overflowY: 'auto',
            bgcolor: 'background.paper',
            zIndex: 2,
          }}
        >
          {leftPanel}
        </Box>

        {/* Center Canvas / Map Area & Bottom Drawer */}
        <Box
          component="main"
          id="mobile-panel-map"
          role="region"
          aria-labelledby="mobile-tab-map"
          sx={{
            flex: 1,
            display: {
              xs: activeTab === 'map' ? 'flex' : 'none',
              md: 'flex',
            },
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            bgcolor: '#070a13',
          }}
        >
          {/* Map Canvas Area */}
          <Box
            sx={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {mapArea}
          </Box>

          {/* Bottom Panel (Heatmap slider / Checkpoints) */}
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
  mapArea: PropTypes.node.isRequired,
  bottomPanel: PropTypes.node,
  mobileTab: PropTypes.string,
  onMobileTabChange: PropTypes.func,
};
