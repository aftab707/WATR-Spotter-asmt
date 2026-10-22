import PropTypes from 'prop-types';
import { Chip } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import WarningIcon from '@mui/icons-material/Warning';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import DangerousIcon from '@mui/icons-material/Dangerous';
import { getRiskConfig } from '../lib/risk';

const ICON_MAP = {
  CheckCircleOutline: CheckCircleOutlineIcon,
  WarningAmber: WarningAmberIcon,
  Warning: WarningIcon,
  ReportProblem: ReportProblemIcon,
  Dangerous: DangerousIcon,
};

/**
 * Reusable Risk Badge / Chip component.
 *
 * Guaranteed invariant: Never color-only — always renders both the text label and icon.
 */
export default function RiskBadge({ level, size = 'small', variant = 'filled', sx = {} }) {
  const cfg = getRiskConfig(level);
  const IconComponent = ICON_MAP[cfg.iconName] || CheckCircleOutlineIcon;

  const isOutlined = variant === 'outlined';

  return (
    <Chip
      size={size}
      icon={<IconComponent style={{ color: cfg.color, fontSize: size === 'small' ? 16 : 18 }} />}
      label={cfg.label}
      variant={isOutlined ? 'outlined' : 'filled'}
      sx={{
        bgcolor: isOutlined ? 'transparent' : cfg.bgColor,
        color: cfg.color,
        borderColor: cfg.borderColor,
        fontWeight: 600,
        letterSpacing: 0.2,
        ...sx,
      }}
    />
  );
}

RiskBadge.propTypes = {
  level: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  size: PropTypes.oneOf(['small', 'medium']),
  variant: PropTypes.oneOf(['filled', 'outlined']),
  sx: PropTypes.object,
};
