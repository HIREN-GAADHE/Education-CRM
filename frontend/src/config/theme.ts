import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
    interface Palette {
        neutral: Palette['primary'];
    }
    interface PaletteOptions {
        neutral?: PaletteOptions['primary'];
    }
}

// =============================================
// UNIFIED COLOR PALETTE - Single Source of Truth
// =============================================
const colors = {
    // Primary - Indigo
    primary: {
        50: '#eef2ff',
        100: '#e0e7ff',
        200: '#c7d2fe',
        300: '#a5b4fc',
        400: '#818cf8',
        500: '#6366f1',
        600: '#4f46e5',
        700: '#4338ca',
        800: '#3730a3',
        900: '#312e81',
    },
    // Neutral - Slate
    slate: {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a',
    },
    // Semantic Colors
    success: { main: '#10b981', light: '#34d399', dark: '#059669' },
    warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
    error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
    info: { main: '#0ea5e9', light: '#38bdf8', dark: '#0284c7' },
};

// =============================================
// DYNAMIC COLOR UTILITIES
// =============================================

// Adjust color brightness (positive = lighter, negative = darker)
function adjustColor(hex: string, amount: number): string {
    const clamp = (val: number) => Math.min(255, Math.max(0, val));

    // Remove # if present
    hex = hex.replace('#', '');

    // Parse RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Adjust
    const newR = clamp(r + amount);
    const newG = clamp(g + amount);
    const newB = clamp(b + amount);

    // Return hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

// Generate primary color palette from a single color
function generatePrimaryPalette(mainColor: string) {
    return {
        50: adjustColor(mainColor, 180),
        100: adjustColor(mainColor, 150),
        200: adjustColor(mainColor, 120),
        300: adjustColor(mainColor, 80),
        400: adjustColor(mainColor, 40),
        500: mainColor,
        600: adjustColor(mainColor, -20),
        700: adjustColor(mainColor, -40),
        800: adjustColor(mainColor, -60),
        900: adjustColor(mainColor, -80),
    };
}

// Common typography and shape settings
const commonSettings = {
    typography: {
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        h1: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' },
        h2: { fontSize: '1.875rem', fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.01em' },
        h3: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.3 },
        h4: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4 },
        h5: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
        h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },
        body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
        body2: { fontSize: '0.875rem', lineHeight: 1.6 },
        caption: { fontSize: '0.75rem', lineHeight: 1.5 },
        button: { textTransform: 'none' as const, fontWeight: 600, fontSize: '0.875rem' },
    },
    shape: {
        borderRadius: 10,
    },
};

// =============================================
// LIGHT THEME - Clean, Professional, Modern
// =============================================
export const lightTheme = createTheme({
    ...commonSettings,
    palette: {
        mode: 'light',
        primary: {
            main: colors.primary[600],
            light: colors.primary[400],
            dark: colors.primary[700],
            contrastText: '#ffffff',
        },
        secondary: {
            main: colors.info.main,
            light: colors.info.light,
            dark: colors.info.dark,
            contrastText: '#ffffff',
        },
        error: colors.error,
        warning: colors.warning,
        info: colors.info,
        success: colors.success,
        neutral: {
            main: colors.slate[500],
            light: colors.slate[400],
            dark: colors.slate[600],
        },
        background: {
            default: colors.slate[50],
            paper: '#ffffff',
        },
        text: {
            primary: colors.slate[900],
            secondary: colors.slate[500],
        },
        divider: colors.slate[200],
        action: {
            hover: `${colors.primary[600]}08`,
            selected: `${colors.primary[600]}12`,
            focus: `${colors.primary[600]}18`,
            disabled: colors.slate[300],
            disabledBackground: colors.slate[100],
        },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                ':root': { colorScheme: 'light' },
                '*': { boxSizing: 'border-box' },
                body: {
                    backgroundColor: colors.slate[50],
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                },
                '::-webkit-scrollbar': { width: '8px', height: '8px' },
                '::-webkit-scrollbar-track': { background: colors.slate[100] },
                '::-webkit-scrollbar-thumb': {
                    background: colors.slate[300],
                    borderRadius: '4px',
                    '&:hover': { background: colors.slate[400] },
                },
            },
        },
        MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    padding: '8px 18px',
                    transition: 'all 0.15s ease',
                },
                contained: {
                    '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: `0 4px 12px ${colors.primary[600]}30`,
                    },
                },
                outlined: {
                    borderColor: colors.slate[300],
                    '&:hover': {
                        borderColor: colors.primary[600],
                        backgroundColor: `${colors.primary[600]}08`,
                    },
                },
                text: {
                    '&:hover': { backgroundColor: `${colors.primary[600]}08` },
                },
            },
        },
        MuiCard: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    border: `1px solid ${colors.slate[200]}`,
                    backgroundColor: '#ffffff',
                    transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                    '&:hover': {
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
                    },
                },
            },
        },
        MuiPaper: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
                root: { backgroundImage: 'none' },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#ffffff',
                    borderRight: `1px solid ${colors.slate[200]}`,
                },
            },
        },
        MuiAppBar: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
                root: {
                    backgroundColor: '#ffffff',
                    borderBottom: `1px solid ${colors.slate[200]}`,
                    color: colors.slate[900],
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 8,
                        backgroundColor: '#ffffff',
                        '& fieldset': { borderColor: colors.slate[300] },
                        '&:hover fieldset': { borderColor: colors.slate[400] },
                        '&.Mui-focused fieldset': {
                            borderColor: colors.primary[600],
                            borderWidth: 2,
                        },
                    },
                },
            },
        },
        MuiSelect: {
            styleOverrides: {
                root: { borderRadius: 8 },
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    margin: '2px 8px',
                    padding: '10px 12px',
                    transition: 'all 0.12s ease',
                    '&:hover': {
                        backgroundColor: colors.slate[100],
                    },
                    '&.Mui-selected': {
                        backgroundColor: `${colors.primary[600]}10`,
                        color: colors.primary[700],
                        '&:hover': { backgroundColor: `${colors.primary[600]}15` },
                        '& .MuiListItemIcon-root': { color: colors.primary[600] },
                        '& .MuiListItemText-primary': { fontWeight: 600 },
                    },
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: { borderRadius: 6, fontWeight: 500 },
                filled: { border: 'none' },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: 12,
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12)',
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                indicator: { borderRadius: 2, height: 3 },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 500,
                    minHeight: 44,
                    '&.Mui-selected': { fontWeight: 600 },
                },
            },
        },
        MuiAvatar: {
            styleOverrides: {
                root: { fontWeight: 600 },
            },
        },
        MuiTableHead: {
            styleOverrides: {
                root: {
                    '& .MuiTableCell-root': {
                        backgroundColor: colors.slate[50],
                        fontWeight: 600,
                        color: colors.slate[700],
                        borderBottom: `2px solid ${colors.slate[200]}`,
                        padding: '14px 16px',
                    },
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    '&:hover': { backgroundColor: colors.slate[50] },
                    '& .MuiTableCell-root': {
                        borderBottom: `1px solid ${colors.slate[100]}`,
                        padding: '12px 16px',
                    },
                },
            },
        },
        MuiAlert: {
            styleOverrides: {
                root: { borderRadius: 8 },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: colors.slate[800],
                    fontSize: '0.75rem',
                    borderRadius: 6,
                    padding: '6px 12px',
                },
            },
        },
        MuiMenu: {
            styleOverrides: {
                paper: {
                    borderRadius: 8,
                    border: `1px solid ${colors.slate[200]}`,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    margin: '2px 6px',
                    padding: '8px 12px',
                    '&:hover': { backgroundColor: colors.slate[100] },
                },
            },
        },
        MuiDivider: {
            styleOverrides: {
                root: { borderColor: colors.slate[200] },
            },
        },
    },
});

// =============================================
// DARK THEME - Modern, Sleek, Premium
// =============================================
export const darkTheme = createTheme({
    ...commonSettings,
    palette: {
        mode: 'dark',
        primary: {
            main: colors.primary[400],
            light: colors.primary[300],
            dark: colors.primary[500],
            contrastText: '#000000',
        },
        secondary: {
            main: colors.info.light,
            light: '#7dd3fc',
            dark: colors.info.main,
            contrastText: '#000000',
        },
        error: { main: '#f87171', light: '#fca5a5', dark: '#ef4444' },
        warning: { main: '#fbbf24', light: '#fcd34d', dark: '#f59e0b' },
        info: { main: '#38bdf8', light: '#7dd3fc', dark: '#0ea5e9' },
        success: { main: '#34d399', light: '#6ee7b7', dark: '#10b981' },
        neutral: {
            main: colors.slate[400],
            light: colors.slate[300],
            dark: colors.slate[500],
        },
        background: {
            default: colors.slate[900],
            paper: colors.slate[800],
        },
        text: {
            primary: colors.slate[100],
            secondary: colors.slate[400],
        },
        divider: `${colors.slate[400]}20`,
        action: {
            hover: `${colors.primary[400]}12`,
            selected: `${colors.primary[400]}20`,
            focus: `${colors.primary[400]}25`,
            disabled: colors.slate[600],
            disabledBackground: colors.slate[700],
        },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                ':root': { colorScheme: 'dark' },
                '*': { boxSizing: 'border-box' },
                body: {
                    backgroundColor: colors.slate[900],
                    backgroundImage: `radial-gradient(ellipse at top, ${colors.primary[900]}40 0%, ${colors.slate[900]} 60%)`,
                    backgroundAttachment: 'fixed',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                },
                '::-webkit-scrollbar': { width: '8px', height: '8px' },
                '::-webkit-scrollbar-track': { background: colors.slate[800] },
                '::-webkit-scrollbar-thumb': {
                    background: colors.slate[600],
                    borderRadius: '4px',
                    '&:hover': { background: colors.slate[500] },
                },
            },
        },
        MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    padding: '8px 18px',
                    transition: 'all 0.15s ease',
                },
                contained: {
                    background: `linear-gradient(135deg, ${colors.primary[500]} 0%, ${colors.primary[600]} 100%)`,
                    '&:hover': {
                        background: `linear-gradient(135deg, ${colors.primary[400]} 0%, ${colors.primary[500]} 100%)`,
                        transform: 'translateY(-1px)',
                        boxShadow: `0 4px 16px ${colors.primary[500]}50`,
                    },
                },
                outlined: {
                    borderColor: `${colors.primary[400]}60`,
                    '&:hover': {
                        borderColor: colors.primary[400],
                        backgroundColor: `${colors.primary[400]}15`,
                    },
                },
            },
        },
        MuiCard: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    border: `1px solid ${colors.slate[700]}`,
                    backgroundColor: `${colors.slate[800]}cc`,
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                        borderColor: `${colors.primary[400]}40`,
                        boxShadow: `0 4px 20px ${colors.slate[900]}80`,
                    },
                },
            },
        },
        MuiPaper: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: colors.slate[800],
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: `${colors.slate[900]}f5`,
                    backdropFilter: 'blur(12px)',
                    borderRight: `1px solid ${colors.slate[700]}`,
                },
            },
        },
        MuiAppBar: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
                root: {
                    backgroundColor: `${colors.slate[900]}e0`,
                    backdropFilter: 'blur(12px)',
                    borderBottom: `1px solid ${colors.slate[700]}`,
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 8,
                        backgroundColor: `${colors.slate[800]}80`,
                        '& fieldset': { borderColor: colors.slate[600] },
                        '&:hover fieldset': { borderColor: colors.slate[500] },
                        '&.Mui-focused fieldset': {
                            borderColor: colors.primary[400],
                            borderWidth: 2,
                        },
                    },
                },
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    margin: '2px 8px',
                    padding: '10px 12px',
                    transition: 'all 0.12s ease',
                    '&:hover': {
                        backgroundColor: `${colors.primary[400]}12`,
                    },
                    '&.Mui-selected': {
                        backgroundColor: `${colors.primary[400]}18`,
                        borderLeft: `3px solid ${colors.primary[400]}`,
                        '&:hover': { backgroundColor: `${colors.primary[400]}25` },
                        '& .MuiListItemIcon-root': { color: colors.primary[400] },
                    },
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: { borderRadius: 6, fontWeight: 500 },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: 12,
                    backgroundColor: colors.slate[800],
                    border: `1px solid ${colors.slate[700]}`,
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                indicator: {
                    borderRadius: 2,
                    height: 3,
                    backgroundColor: colors.primary[400],
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 500,
                    minHeight: 44,
                },
            },
        },
        MuiTableHead: {
            styleOverrides: {
                root: {
                    '& .MuiTableCell-root': {
                        backgroundColor: `${colors.slate[900]}80`,
                        fontWeight: 600,
                        color: colors.slate[200],
                        borderBottom: `1px solid ${colors.slate[700]}`,
                    },
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    '&:hover': { backgroundColor: `${colors.primary[400]}08` },
                    '& .MuiTableCell-root': { borderBottom: `1px solid ${colors.slate[700]}50` },
                },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: colors.slate[700],
                    border: `1px solid ${colors.slate[600]}`,
                    fontSize: '0.75rem',
                    borderRadius: 6,
                },
            },
        },
        MuiMenu: {
            styleOverrides: {
                paper: {
                    borderRadius: 8,
                    backgroundColor: colors.slate[800],
                    border: `1px solid ${colors.slate[700]}`,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    margin: '2px 6px',
                    '&:hover': { backgroundColor: `${colors.primary[400]}15` },
                },
            },
        },
        MuiDivider: {
            styleOverrides: {
                root: { borderColor: colors.slate[700] },
            },
        },
    },
});

// Export default
export const theme = lightTheme;

// =============================================
// DYNAMIC THEME CREATOR
// =============================================
// Creates a theme with a custom primary color
export function createDynamicTheme(mode: 'light' | 'dark', primaryColorHex: string = '#667eea') {
    const dynamicPrimary = generatePrimaryPalette(primaryColorHex);

    const baseTheme = mode === 'dark' ? darkTheme : lightTheme;

    return createTheme({
        ...baseTheme,
        palette: {
            ...baseTheme.palette,
            primary: {
                main: dynamicPrimary[500],
                light: dynamicPrimary[300],
                dark: dynamicPrimary[700],
                contrastText: mode === 'dark' ? '#000000' : '#ffffff',
            },
        },
        components: {
            ...baseTheme.components,
            MuiButton: {
                ...baseTheme.components?.MuiButton,
                styleOverrides: {
                    ...baseTheme.components?.MuiButton?.styleOverrides,
                    contained: {
                        ...(typeof baseTheme.components?.MuiButton?.styleOverrides?.contained === 'object'
                            ? baseTheme.components.MuiButton.styleOverrides.contained
                            : {}),
                        background: mode === 'dark'
                            ? `linear-gradient(135deg, ${dynamicPrimary[500]} 0%, ${dynamicPrimary[600]} 100%)`
                            : undefined,
                        '&:hover': {
                            background: mode === 'dark'
                                ? `linear-gradient(135deg, ${dynamicPrimary[400]} 0%, ${dynamicPrimary[500]} 100%)`
                                : undefined,
                            transform: 'translateY(-1px)',
                            boxShadow: `0 4px 16px ${dynamicPrimary[500]}50`,
                        },
                    },
                },
            },
            MuiListItemButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        margin: '2px 8px',
                        padding: '10px 12px',
                        transition: 'all 0.12s ease',
                        '&:hover': {
                            backgroundColor: mode === 'dark'
                                ? `${dynamicPrimary[400]}12`
                                : colors.slate[100],
                        },
                        '&.Mui-selected': {
                            backgroundColor: mode === 'dark'
                                ? `${dynamicPrimary[400]}18`
                                : `${dynamicPrimary[600]}10`,
                            borderLeft: mode === 'dark' ? `3px solid ${dynamicPrimary[400]}` : undefined,
                            color: mode === 'light' ? dynamicPrimary[700] : undefined,
                            '&:hover': {
                                backgroundColor: mode === 'dark'
                                    ? `${dynamicPrimary[400]}25`
                                    : `${dynamicPrimary[600]}15`
                            },
                            '& .MuiListItemIcon-root': {
                                color: mode === 'dark' ? dynamicPrimary[400] : dynamicPrimary[600]
                            },
                        },
                    },
                },
            },
            MuiTabs: {
                styleOverrides: {
                    indicator: {
                        borderRadius: 2,
                        height: 3,
                        backgroundColor: mode === 'dark' ? dynamicPrimary[400] : dynamicPrimary[600],
                    },
                },
            },
        },
    });
}

