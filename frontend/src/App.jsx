import { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Paper,
  Chip,
  Button,
  Stack,
  Alert,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import NavigationIcon from '@mui/icons-material/Navigation';
import { RISK_PALETTE } from './theme/theme';

export default function App() {
  const [healthStatus, setHealthStatus] = useState('checking');
  const [errorMessage, setErrorMessage] = useState('');

  const checkHealth = async () => {
    setHealthStatus('checking');
    setErrorMessage('');
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(`${apiBase}/api/health/`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.status === 'ok') {
        setHealthStatus('ok');
      } else {
        setHealthStatus('error');
        setErrorMessage('Unexpected response status');
      }
    } catch (err) {
      setHealthStatus('error');
      setErrorMessage(err.message || 'Failed to connect to backend');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <LocalShippingIcon color="primary" />
            <Typography variant="h6" component="div" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              WATR
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>
              | Weather-Aware Truck Routing
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            {healthStatus === 'ok' && (
              <Chip
                icon={<CheckCircleOutlineIcon />}
                label="Backend: Online"
                color="success"
                size="small"
                variant="outlined"
              />
            )}
            {healthStatus === 'error' && (
              <Chip
                icon={<ErrorOutlineIcon />}
                label="Backend: Offline"
                color="error"
                size="small"
                variant="outlined"
              />
            )}
            {healthStatus === 'checking' && (
              <Chip label="Checking..." size="small" variant="outlined" />
            )}
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={checkHealth}
            >
              Ping API
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4, flex: 1, overflowY: 'auto' }}>
        <Stack spacing={3}>
          {errorMessage && (
            <Alert severity="warning" onClose={() => setErrorMessage('')}>
              Backend health check note: {errorMessage} (Make sure Django is running on port 8000)
            </Alert>
          )}

          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
              Step 0 — Monorepo Bootstrap & MUI Dark Theme Ready
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              The application foundation is initialized with Django DRF backend and React 18 + MUI
              dark theme frontend.
            </Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
              <Paper
                variant="outlined"
                sx={{ p: 2, flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}
              >
                <NavigationIcon color="primary" />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Routing Engine
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    3 route alternatives with waypoint sampling
                  </Typography>
                </Box>
              </Paper>

              <Paper
                variant="outlined"
                sx={{ p: 2, flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}
              >
                <CloudQueueIcon color="primary" />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Weather Integration
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Open-Meteo batch checkpoint forecasts & 0–48h heatmap
                  </Typography>
                </Box>
              </Paper>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Design System Risk Palette (Section 8 Standard)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Uniform palette across map markers, summary chips, risk strips, and heatmap legends:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {Object.entries(RISK_PALETTE).map(([key, item]) => (
                <Chip
                  key={key}
                  label={item.label}
                  sx={{
                    bgcolor: item.color,
                    color: item.contrastText,
                    fontWeight: 700,
                    px: 1,
                  }}
                />
              ))}
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
