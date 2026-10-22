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
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import StorageIcon from '@mui/icons-material/Storage';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import { useHealthCheck } from '../api/queries';
import { IS_MOCK_MODE } from '../api/client';

export default function AppHeader({ onRefreshPlan }) {
  const { data: health, isLoading, isError, refetch, isFetching } = useHealthCheck();

  const isOnline = !isError && health?.status === 'ok';

  return (
    <AppBar position="sticky" elevation={0}>
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: 64, px: { xs: 2, md: 3 } }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              borderRadius: 1.5,
              bgcolor: 'rgba(56, 189, 248, 0.12)',
              color: 'primary.main',
              border: '1px solid rgba(56, 189, 248, 0.25)',
            }}
          >
            <LocalShippingIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h6" component="h1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              WATR
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>
              Weather-Aware Truck Routing
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center">
          {/* Mock mode indicator */}
          <Tooltip title={IS_MOCK_MODE ? 'Operating in offline fixture mock mode' : 'Connected to live Django REST backend'}>
            <Chip
              icon={IS_MOCK_MODE ? <StorageIcon sx={{ fontSize: 16 }} /> : <CloudDoneIcon sx={{ fontSize: 16 }} />}
              label={IS_MOCK_MODE ? 'Mock Mode' : 'Live API'}
              size="small"
              variant="outlined"
              color={IS_MOCK_MODE ? 'secondary' : 'default'}
              sx={{ fontWeight: 600, borderColor: 'rgba(255,255,255,0.15)' }}
            />
          </Tooltip>

          {/* Backend Health Status Badge */}
          {isLoading || isFetching ? (
            <Chip
              label="Checking..."
              size="small"
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.15)' }}
            />
          ) : isOnline ? (
            <Chip
              icon={<CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
              label="Backend: Online"
              color="success"
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
          ) : (
            <Tooltip title="Backend unreachable at port 8000. Switch to mock mode or start Django server.">
              <Chip
                icon={<ErrorOutlineIcon sx={{ fontSize: 16 }} />}
                label="Backend: Offline"
                color="error"
                size="small"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            </Tooltip>
          )}

          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
            onClick={() => {
              refetch();
              if (onRefreshPlan) onRefreshPlan();
            }}
            disabled={isFetching}
            sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'text.primary' }}
          >
            Refresh
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

AppHeader.propTypes = {
  onRefreshPlan: PropTypes.func,
};
