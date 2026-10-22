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
 * Per Step 13:
 * - Guaranteed sorted by mile ascending.
 * - Surfaces: mile, ETA, wind, rain, snow, risk, drivers, load rule, and segment miles.
 * - Values match API data exactly.
 * - Clicking a row or focus button focuses that checkpoint on the map.
 * - Paginated to prevent UI lag and maintain zero layout shift.
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
          p: 1.75,
          px: 2,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          bgcolor: 'background.default',
        }}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Route Checkpoints ({sortedCheckpoints.length})
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Weather conditions at truck ETA • Ordered by distance
          </Typography>
        </Box>

        {/* Filter Chips */}
        <Stack direction="row" spacing={1} alignItems="center">
          <FilterAltIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Chip
            label={`All (${sortedCheckpoints.length})`}
            size="small"
            variant={riskFilter === 'ALL' ? 'filled' : 'outlined'}
            color={riskFilter === 'ALL' ? 'primary' : 'default'}
            onClick={() => {
              setRiskFilter('ALL');
              setPage(0);
            }}
            sx={{ fontSize: '0.6875rem', height: 22 }}
          />

          {hazardCount > 0 && (
            <Chip
              label={`High / Severe (${hazardCount})`}
              size="small"
              variant={riskFilter === 'HAZARDS' ? 'filled' : 'outlined'}
              color={riskFilter === 'HAZARDS' ? 'warning' : 'default'}
              onClick={() => {
                setRiskFilter('HAZARDS');
                setPage(0);
              }}
              sx={{ fontSize: '0.6875rem', height: 22 }}
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
              sx={{ fontSize: '0.6875rem', height: 22 }}
            />
          )}
        </Stack>
      </Box>

      {/* Checkpoints Data Table */}
      <TableContainer sx={{ maxHeight: 380 }}>
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

      {/* Pagination Controls */}
      <TablePagination
        rowsPerPageOptions={[10, 25, 50, { label: 'All', value: -1 }]}
        component="div"
        count={filteredCheckpoints.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        sx={{
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
