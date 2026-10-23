import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import FilterAltIcon from '@mui/icons-material/FilterAlt';

import RiskBadge from './RiskBadge';
import {
  formatMiles,
  formatMph,
  formatInHr,
  formatDateTime,
} from '../lib/formatters';

/**
 * Checkpoint Weather Table.
 *
 * Per Step 13 & Mobile Polish:
 * - Desktop (>= sm): Full 9-column engineering data table with sticky headers.
 * - Mobile (< sm): Thumb-friendly compact card list, zero horizontal scroll, instant focus targets.
 * - Guaranteed sorted by mile ascending.
 * - Surfaces: mile, ETA, wind, rain, snow, risk, drivers, load rule, and segment miles.
 */
export default function CheckpointTable({
  checkpoints = [],
  onSelectCheckpoint,
  selectedCheckpointIndex = null,
}) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [riskFilter, setRiskFilter] = useState('ALL'); // 'ALL' | 'HAZARDS' | 'LOAD_RULE'

  // Sort checkpoints ascending by mile (spec requirement)
  const sortedCheckpoints = useMemo(() => {
    return [...checkpoints].sort((a, b) => a.mile - b.mile);
  }, [checkpoints]);

  // Apply filter
  const filteredCheckpoints = useMemo(() => {
    if (riskFilter === 'HAZARDS') {
      return sortedCheckpoints.filter((cp) => cp.risk >= 3);
    }
    if (riskFilter === 'LOAD_RULE') {
      return sortedCheckpoints.filter((cp) => cp.load_rule_applied);
    }
    return sortedCheckpoints;
  }, [sortedCheckpoints, riskFilter]);

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const visibleRows = useMemo(() => {
    if (rowsPerPage === -1) return filteredCheckpoints;
    return filteredCheckpoints.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredCheckpoints, page, rowsPerPage]);

  const hazardCount = useMemo(
    () => sortedCheckpoints.filter((cp) => cp.risk >= 3).length,
    [sortedCheckpoints]
  );
  const loadRuleCount = useMemo(
    () => sortedCheckpoints.filter((cp) => cp.load_rule_applied).length,
    [sortedCheckpoints]
  );

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Table Toolbar & Filters */}
      <Box
        sx={{
          p: { xs: 1.25, sm: 1.75 },
          px: { xs: 1.5, sm: 2 },
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          bgcolor: 'background.default',
        }}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
            Checkpoints ({sortedCheckpoints.length})
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
            Weather conditions at truck ETA • Ordered by distance
          </Typography>
        </Box>

        {/* Filter Chips */}
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
          <FilterAltIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
          <Chip
            label={`All (${sortedCheckpoints.length})`}
            size="small"
            variant={riskFilter === 'ALL' ? 'filled' : 'outlined'}
            color={riskFilter === 'ALL' ? 'primary' : 'default'}
            onClick={() => {
              setRiskFilter('ALL');
              setPage(0);
            }}
            sx={{ fontSize: '0.65rem', height: 22 }}
          />

          {hazardCount > 0 && (
            <Chip
              label={`High/Severe (${hazardCount})`}
              size="small"
              variant={riskFilter === 'HAZARDS' ? 'filled' : 'outlined'}
              color={riskFilter === 'HAZARDS' ? 'warning' : 'default'}
              onClick={() => {
                setRiskFilter('HAZARDS');
                setPage(0);
              }}
              sx={{ fontSize: '0.65rem', height: 22 }}
            />
          )}

          {loadRuleCount > 0 && (
            <Chip
              label={`Load Rule (${loadRuleCount})`}
              size="small"
              variant={riskFilter === 'LOAD_RULE' ? 'filled' : 'outlined'}
              color={riskFilter === 'LOAD_RULE' ? 'error' : 'default'}
              onClick={() => {
                setRiskFilter('LOAD_RULE');
                setPage(0);
              }}
              sx={{ fontSize: '0.65rem', height: 22 }}
            />
          )}
        </Stack>
      </Box>

      {/* 1. Mobile Card List View (< sm screens) */}
      <Box
        sx={{
          display: { xs: 'block', sm: 'none' },
          p: 1.25,
          maxHeight: { xs: 'calc(100dvh - 280px)', sm: 'none' },
          minHeight: 280,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(56, 189, 248, 0.45) rgba(255, 255, 255, 0.05)',
          '&::-webkit-scrollbar': {
            width: '6px',
            display: 'block',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(56, 189, 248, 0.45)',
            borderRadius: '4px',
            border: '1px solid rgba(0, 0, 0, 0.2)',
            '&:hover': {
              background: 'rgba(56, 189, 248, 0.75)',
            },
          },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, px: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', fontWeight: 600 }}>
            Showing all {filteredCheckpoints.length} checkpoints
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'primary.main',
              fontSize: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontWeight: 600,
            }}
          >
            ↕ Scroll to explore
          </Typography>
        </Stack>

        {filteredCheckpoints.length === 0 ? (
          <Typography variant="body2" sx={{ py: 3, textAlign: 'center', color: 'text.secondary', fontSize: '0.8rem' }}>
            No checkpoints match the active filter.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {filteredCheckpoints.map((cp) => {
              const isSelected = selectedCheckpointIndex === cp.index;
              const isHazard = cp.risk >= 3;

              return (
                <Paper
                  key={cp.index}
                  onClick={() => onSelectCheckpoint && onSelectCheckpoint(cp)}
                  sx={{
                    p: 1.25,
                    borderRadius: 1.5,
                    bgcolor: isSelected
                      ? 'rgba(56, 189, 248, 0.12)'
                      : isHazard
                        ? 'rgba(239, 68, 68, 0.06)'
                        : 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid',
                    borderColor: isSelected
                      ? 'primary.main'
                      : isHazard
                        ? 'rgba(239, 68, 68, 0.3)'
                        : 'rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    '&:active': { bgcolor: 'rgba(56, 189, 248, 0.2)' },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                        Mile {cp.mile.toFixed(1)}
                      </Typography>
                      <RiskBadge level={cp.risk} size="small" />
                      {cp.load_rule_applied && (
                        <Chip
                          icon={<WarningAmberIcon sx={{ fontSize: '11px !important' }} />}
                          label="Heavy Load"
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.575rem', fontWeight: 700 }}
                        />
                      )}
                    </Stack>

                    <Tooltip title="Focus on map">
                      <IconButton
                        size="small"
                        color={isSelected ? 'primary' : 'default'}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectCheckpoint) onSelectCheckpoint(cp);
                        }}
                        sx={{ p: 0.5, border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        <MyLocationIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mt: 0.75, color: 'text.secondary', fontSize: '0.72rem' }}
                  >
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                      ETA: <strong>{formatDateTime(cp.eta)}</strong>
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        color: cp.wind_mph >= 35 ? '#ef4444' : 'text.primary',
                        fontSize: '0.72rem',
                      }}
                    >
                      💨 {formatMph(cp.wind_mph)}
                      {cp.rain_in_hr > 0 && ` • 🌧️ ${formatInHr(cp.rain_in_hr)}`}
                      {cp.snow_in_hr > 0 && ` • ❄️ ${formatInHr(cp.snow_in_hr)}`}
                    </Typography>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* 2. Desktop Full 9-Column Table View (>= sm screens) */}
      <TableContainer
        sx={{
          display: { xs: 'none', sm: 'block' },
          maxHeight: 440,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(56, 189, 248, 0.45) rgba(255, 255, 255, 0.05)',
          '&::-webkit-scrollbar': {
            width: '6px',
            height: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(255, 255, 255, 0.04)',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(56, 189, 248, 0.45)',
            borderRadius: '4px',
            '&:hover': {
              background: 'rgba(56, 189, 248, 0.75)',
            },
          },
        }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700, width: 80 }}>
                Mile
              </TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>
                ETA (Local)
              </TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>
                Risk Level
              </TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>
                Wind
              </TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>
                Precipitation
              </TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>
                Drivers
              </TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>
                Load Rule
              </TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>
                Segment
              </TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700, width: 60 }} align="center">
                Focus
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No checkpoints match the active filter.
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((cp) => {
                const isSelected = selectedCheckpointIndex === cp.index;
                const isHazard = cp.risk >= 3;

                return (
                  <TableRow
                    key={cp.index}
                    hover
                    onClick={() => onSelectCheckpoint && onSelectCheckpoint(cp)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: isSelected
                        ? 'rgba(56, 189, 248, 0.1)'
                        : isHazard
                          ? 'rgba(239, 68, 68, 0.03)'
                          : 'transparent',
                      transition: 'background-color 0.1s',
                    }}
                  >
                    {/* Mile */}
                    <TableCell sx={{ fontWeight: 700 }}>
                      {cp.mile.toFixed(1)}
                    </TableCell>

                    {/* ETA */}
                    <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      {formatDateTime(cp.eta)}
                    </TableCell>

                    {/* Risk Badge */}
                    <TableCell>
                      <RiskBadge level={cp.risk} size="small" />
                    </TableCell>

                    {/* Wind */}
                    <TableCell sx={{ fontWeight: cp.wind_mph >= 35 ? 700 : 400 }}>
                      {formatMph(cp.wind_mph)}
                    </TableCell>

                    {/* Precipitation (Rain / Snow) */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {cp.snow_in_hr > 0 ? (
                        <Typography variant="caption" sx={{ color: '#93c5fd', fontWeight: 600 }}>
                          ❄️ {formatInHr(cp.snow_in_hr)}
                        </Typography>
                      ) : cp.rain_in_hr > 0 ? (
                        <Typography variant="caption" sx={{ color: '#60a5fa', fontWeight: 600 }}>
                          🌧️ {formatInHr(cp.rain_in_hr)}
                        </Typography>
                      ) : (
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          0.00 in/hr
                        </Typography>
                      )}
                    </TableCell>

                    {/* Drivers */}
                    <TableCell sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                      {Array.isArray(cp.drivers) && cp.drivers.length > 0 ? cp.drivers.join(', ') : 'None'}
                    </TableCell>

                    {/* Cargo Load Rule */}
                    <TableCell>
                      {cp.load_rule_applied ? (
                        <Tooltip title="Risk elevated due to gross cargo load weight on high winds">
                          <Chip
                            icon={<WarningAmberIcon sx={{ fontSize: '13px !important' }} />}
                            label="Elevated"
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                          />
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          —
                        </Typography>
                      )}
                    </TableCell>

                    {/* Segment Miles */}
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {formatMiles(cp.segment_miles)}
                    </TableCell>

                    {/* Focus Map Button */}
                    <TableCell align="center">
                      <Tooltip title="Focus checkpoint on map">
                        <IconButton
                          size="small"
                          color={isSelected ? 'primary' : 'default'}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectCheckpoint) onSelectCheckpoint(cp);
                          }}
                        >
                          <MyLocationIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination Controls (Desktop Only) */}
      <TablePagination
        rowsPerPageOptions={[10, 25, 50, { label: 'All', value: -1 }]}
        component="div"
        count={filteredCheckpoints.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        sx={{
          display: { xs: 'none', sm: 'flex' },
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          bgcolor: 'background.default',
        }}
      />
    </Paper>
  );
}

CheckpointTable.propTypes = {
  checkpoints: PropTypes.arrayOf(
    PropTypes.shape({
      index: PropTypes.number.isRequired,
      mile: PropTypes.number.isRequired,
      eta: PropTypes.string.isRequired,
      risk: PropTypes.number.isRequired,
      risk_label: PropTypes.string.isRequired,
      wind_mph: PropTypes.number.isRequired,
      rain_in_hr: PropTypes.number.isRequired,
      snow_in_hr: PropTypes.number.isRequired,
      drivers: PropTypes.arrayOf(PropTypes.string),
      load_rule_applied: PropTypes.bool,
      segment_miles: PropTypes.number,
    })
  ).isRequired,
  onSelectCheckpoint: PropTypes.func,
  selectedCheckpointIndex: PropTypes.number,
};
