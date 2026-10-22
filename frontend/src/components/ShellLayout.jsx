import PropTypes from 'prop-types';
import { Box } from '@mui/material';

/**
 * Shell Layout dividing the screen into:
 * - Fixed Top Header
 * - Left Panel (Trip Form + Route Cards, scrollable)
 * - Main Center Area (Map View)
 * - Bottom / Secondary Panel (0-48h Heatmap Slider + Checkpoint details)
 */
export default function ShellLayout({ header, leftPanel, mapArea, bottomPanel }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', bgcolor: 'background.default' }}>
      {/* Top Navigation */}
      {header}

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
          sx={{
            width: { xs: '100%', md: 430, lg: 460 },
            borderRight: { md: 1 },
            borderBottom: { xs: 1, md: 0 },
            borderColor: 'divider',
            display: 'flex',
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
          sx={{
            flex: 1,
            display: 'flex',
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
};
