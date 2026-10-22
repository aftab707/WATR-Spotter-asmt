import { createTheme } from '@mui/material/styles';

export const RISK_PALETTE = {
  LOW: {
    color: '#22c55e',
    contrastText: '#052e16',
    label: 'Low',
  },
  MODERATE: {
    color: '#eab308',
    contrastText: '#422006',
    label: 'Moderate',
  },
  HIGH: {
    color: '#f97316',
    contrastText: '#431407',
    label: 'High',
  },
  SEVERE: {
    color: '#ef4444',
    contrastText: '#450a0a',
    label: 'Severe',
  },
  NO_TRAVEL: {
    color: '#9333ea',
    contrastText: '#3b0764',
    label: 'No Travel',
  },
};

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#38bdf8', // sky-400
      light: '#7dd3fc',
      dark: '#0284c7',
      contrastText: '#0f172a',
    },
    secondary: {
      main: '#818cf8', // indigo-400
      light: '#a5b4fc',
      dark: '#4f46e5',
      contrastText: '#ffffff',
    },
    background: {
      default: '#0b0f19',
      paper: '#111827',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
    text: {
      primary: '#f1f5f9',
      secondary: '#94a3b8',
    },
  },
  spacing: 8,
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'].join(','),
    h6: {
      fontWeight: 600,
    },
    subtitle1: {
      fontWeight: 500,
    },
    body1: {
      fontWeight: 400,
    },
    body2: {
      fontWeight: 400,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
  },
});
