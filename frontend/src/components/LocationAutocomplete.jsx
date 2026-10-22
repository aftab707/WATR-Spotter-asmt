import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Autocomplete,
  TextField,
  CircularProgress,
  Box,
  Typography,
  Stack,
} from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import { useDebounce } from '../lib/useDebounce';
import { useGeocode } from '../api/queries';

/**
 * Debounced Location Autocomplete component.
 *
 * Debounces search input by 300ms, calls the geocoding service, and displays
 * loading, empty, and populated suggestion states with keyboard accessibility.
 */
export default function LocationAutocomplete({
  id,
  label,
  placeholder,
  value,
  onChange,
  error = false,
  helperText = '',
  required = false,
  disabled = false,
  startIcon,
}) {
  const [inputValue, setInputValue] = useState('');
  const debouncedQuery = useDebounce(inputValue, 300);

  const { data, isLoading, isFetching } = useGeocode(debouncedQuery, debouncedQuery.length >= 2);
  const options = data?.results || [];

  return (
    <Autocomplete
      id={id}
      disabled={disabled}
      options={options}
      value={value || null}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option?.label || '')}
      isOptionEqualToValue={(option, val) =>
        Boolean(val && option && (option.label === val.label || (option.lat === val.lat && option.lon === val.lon)))
      }
      filterOptions={(x) => x} // Filtering is handled server-side / by geocoder
      loading={isLoading || isFetching}
      noOptionsText={
        inputValue.trim().length < 2
          ? 'Type at least 2 characters to search'
          : 'No locations found'
      }
      onInputChange={(_, newInputValue) => {
        setInputValue(newInputValue);
      }}
      onChange={(_, newValue) => {
        onChange(newValue);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          required={required}
          error={error}
          helperText={helperText}
          size="small"
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <>
                {startIcon && (
                  <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', mr: 1, ml: 0.5 }}>
                    {startIcon}
                  </Box>
                )}
                {params.InputProps.startAdornment}
              </>
            ),
            endAdornment: (
              <>
                {isLoading || isFetching ? (
                  <CircularProgress color="primary" size={18} sx={{ mr: 1 }} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => {
        const { key, ...restProps } = props;
        return (
          <Box component="li" key={key || `${option.lat}-${option.lon}`} {...restProps} sx={{ py: 1, px: 1.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
              <PlaceIcon sx={{ fontSize: 18, color: 'primary.main', flexShrink: 0 }} />
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {option.label}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {option.lat.toFixed(2)}°, {option.lon.toFixed(2)}°
                </Typography>
              </Box>
            </Stack>
          </Box>
        );
      }}
    />
  );
}

LocationAutocomplete.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  value: PropTypes.shape({
    label: PropTypes.string,
    lat: PropTypes.number,
    lon: PropTypes.number,
  }),
  onChange: PropTypes.func.isRequired,
  error: PropTypes.bool,
  helperText: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  startIcon: PropTypes.node,
};
