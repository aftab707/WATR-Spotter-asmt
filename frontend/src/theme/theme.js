import { createTheme } from '@mui/material/styles';
import { RISK_CONFIG } from '../lib/risk';

export const RISK_PALETTE = {
  LOW: {
    color: RISK_CONFIG[1].color,
    contrastText: RISK_CONFIG[1].contrastText,
    label: RISK_CONFIG[1].label,
  },
  MODERATE: {
    color: RISK_CONFIG[2].color,
    contrastText: RISK_CONFIG[2].contrastText,
    label: RISK_CONFIG[2].label,
  },
  HIGH: {
    color: RISK_CONFIG[3].color,
    contrastText: RISK_CONFIG[3].contrastText,
    label: RISK_CONFIG[3].label,
  },
  SEVERE: {
    color: RISK_CONFIG[4].color,
    contrastText: RISK_CONFIG[4].contrastText,
    label: RISK_CONFIG[4].label,
  },
  NO_TRAVEL: {
    color: RISK_CONFIG[5].color,
    contrastText: RISK_CONFIG[5].contrastText,
    label: RISK_CONFIG[5].label,
  },
};

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#38bdf8', // sky-400
      light: '#7dd3fc',
      dark: '#0284c7',
      contrastText: '#0b0f19',
    },
    secondary: {
      main: '#818cf8', // indigo-400
      light: '#a5b4fc',
      dark: '#4f46e5',
      contrastText: '#ffffff',
    },
    background: {
      default: '#0b0f19', // Slate-950
      paper: '#111827', // Gray-900
    },
    divider: 'rgba(255, 255, 255, 0.08)',
    text: {
      primary: '#f1f5f9',
      secondary: '#94a3b8',
    },
  },
  spacing: 8,
  shape: {
    borderRadius: 8, // Single border radius standard
  },
  typography: {
    fontFamily: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'].join(','),
    fontWeightRegular: 400,
    fontWeightMedium: 600,
    fontWeightBold: 600,
    h5: {
      fontWeight: 600,
      letterSpacing: -0.3,
    },
    h6: {
      fontWeight: 600,
      letterSpacing: -0.2,
    },
    subtitle1: {
      fontWeight: 600,
    },
    subtitle2: {
      fontWeight: 600,
    },
    body1: {
      fontWeight: 400,
      lineHeight: 1.5,
    },
    body2: {
      fontWeight: 400,
      lineHeight: 1.45,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
    caption: {
      fontWeight: 400,
      color: '#94a3b8',
    },
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          padding: '8px 16px',
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 600,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#0b0f19',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundImage: 'none',
        },
      },
    },
  },
});
