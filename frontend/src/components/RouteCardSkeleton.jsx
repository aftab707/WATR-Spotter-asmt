import { Box, Paper, Skeleton, Stack } from '@mui/material';

/**
 * Skeleton loading placeholder for Route Cards to eliminate layout shift (CLS).
 */
export default function RouteCardSkeleton() {
  return (
    <Stack spacing={2}>
      {[1, 2, 3].map((idx) => (
        <Paper
          key={idx}
          variant="outlined"
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Header Row */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Skeleton variant="text" width={160} height={24} />
              <Skeleton variant="rounded" width={50} height={20} />
            </Stack>
            <Skeleton variant="rounded" width={100} height={22} />
          </Stack>

          {/* Metrics Row */}
          <Stack direction="row" spacing={2} sx={{ mb: 1.5 }}>
            <Skeleton variant="text" width={80} height={20} />
            <Skeleton variant="text" width={70} height={20} />
            <Skeleton variant="text" width={90} height={20} />
          </Stack>

          {/* Risk Chips Row */}
          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
            <Skeleton variant="rounded" width={85} height={24} />
            <Skeleton variant="rounded" width={95} height={24} />
            <Skeleton variant="rounded" width={80} height={24} />
          </Stack>

          {/* Why this route callout */}
          <Box sx={{ p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
            <Skeleton variant="text" width="90%" height={18} />
          </Box>
        </Paper>
      ))}
    </Stack>
  );
}
