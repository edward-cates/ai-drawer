// Curated color palettes for professional designs
// Each palette includes: primary, secondary, accent, background, surface, text, and semantic colors

export const PALETTES = {
  // Modern blue - clean, professional, trustworthy
  modern: {
    name: 'Modern Blue',
    primary: '#3b82f6',      // Blue 500
    primaryLight: '#60a5fa', // Blue 400
    primaryDark: '#2563eb',  // Blue 600
    secondary: '#8b5cf6',    // Violet 500
    accent: '#f59e0b',       // Amber 500
    background: '#ffffff',
    surface: '#f8fafc',      // Slate 50
    border: '#e2e8f0',       // Slate 200
    text: '#1e293b',         // Slate 800
    textMuted: '#64748b',    // Slate 500
    textInverse: '#ffffff',
    success: '#22c55e',      // Green 500
    warning: '#f59e0b',      // Amber 500
    error: '#ef4444',        // Red 500
    info: '#3b82f6',         // Blue 500
  },

  // Minimal - subtle, elegant, sophisticated
  minimal: {
    name: 'Minimal',
    primary: '#18181b',      // Zinc 900
    primaryLight: '#3f3f46', // Zinc 700
    primaryDark: '#09090b',  // Zinc 950
    secondary: '#a1a1aa',    // Zinc 400
    accent: '#fbbf24',       // Amber 400
    background: '#ffffff',
    surface: '#fafafa',      // Zinc 50
    border: '#e4e4e7',       // Zinc 200
    text: '#18181b',         // Zinc 900
    textMuted: '#71717a',    // Zinc 500
    textInverse: '#ffffff',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },

  // Vibrant - bold, energetic, creative
  vibrant: {
    name: 'Vibrant',
    primary: '#ec4899',      // Pink 500
    primaryLight: '#f472b6', // Pink 400
    primaryDark: '#db2777',  // Pink 600
    secondary: '#8b5cf6',    // Violet 500
    accent: '#06b6d4',       // Cyan 500
    background: '#ffffff',
    surface: '#fdf4ff',      // Fuchsia 50
    border: '#f5d0fe',       // Fuchsia 200
    text: '#1e1b4b',         // Indigo 950
    textMuted: '#6b7280',    // Gray 500
    textInverse: '#ffffff',
    success: '#10b981',      // Emerald 500
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#06b6d4',
  },

  // Nature - calm, organic, sustainable
  nature: {
    name: 'Nature',
    primary: '#16a34a',      // Green 600
    primaryLight: '#22c55e', // Green 500
    primaryDark: '#15803d',  // Green 700
    secondary: '#84cc16',    // Lime 500
    accent: '#f97316',       // Orange 500
    background: '#ffffff',
    surface: '#f0fdf4',      // Green 50
    border: '#bbf7d0',       // Green 200
    text: '#14532d',         // Green 900
    textMuted: '#6b7280',
    textInverse: '#ffffff',
    success: '#22c55e',
    warning: '#eab308',      // Yellow 500
    error: '#dc2626',        // Red 600
    info: '#0ea5e9',         // Sky 500
  },

  // Corporate - professional, reliable, established
  corporate: {
    name: 'Corporate',
    primary: '#1e40af',      // Blue 800
    primaryLight: '#3b82f6', // Blue 500
    primaryDark: '#1e3a8a',  // Blue 900
    secondary: '#475569',    // Slate 600
    accent: '#0891b2',       // Cyan 600
    background: '#ffffff',
    surface: '#f1f5f9',      // Slate 100
    border: '#cbd5e1',       // Slate 300
    text: '#0f172a',         // Slate 900
    textMuted: '#64748b',    // Slate 500
    textInverse: '#ffffff',
    success: '#16a34a',
    warning: '#ca8a04',      // Yellow 600
    error: '#dc2626',
    info: '#0284c7',         // Sky 600
  },

  // Dark - modern dark mode, sleek
  dark: {
    name: 'Dark Mode',
    primary: '#60a5fa',      // Blue 400
    primaryLight: '#93c5fd', // Blue 300
    primaryDark: '#3b82f6',  // Blue 500
    secondary: '#a78bfa',    // Violet 400
    accent: '#fbbf24',       // Amber 400
    background: '#0f172a',   // Slate 900
    surface: '#1e293b',      // Slate 800
    border: '#334155',       // Slate 700
    text: '#f1f5f9',         // Slate 100
    textMuted: '#94a3b8',    // Slate 400
    textInverse: '#0f172a',
    success: '#4ade80',      // Green 400
    warning: '#fbbf24',
    error: '#f87171',        // Red 400
    info: '#60a5fa',
  },

  // Warm - cozy, friendly, approachable
  warm: {
    name: 'Warm',
    primary: '#ea580c',      // Orange 600
    primaryLight: '#f97316', // Orange 500
    primaryDark: '#c2410c',  // Orange 700
    secondary: '#b45309',    // Amber 700
    accent: '#0d9488',       // Teal 600
    background: '#fffbeb',   // Amber 50
    surface: '#fef3c7',      // Amber 100
    border: '#fde68a',       // Amber 200
    text: '#451a03',         // Orange 950
    textMuted: '#92400e',    // Amber 800
    textInverse: '#ffffff',
    success: '#16a34a',
    warning: '#d97706',      // Amber 600
    error: '#dc2626',
    info: '#0891b2',
  },

  // Ocean - fresh, calm, trustworthy
  ocean: {
    name: 'Ocean',
    primary: '#0891b2',      // Cyan 600
    primaryLight: '#06b6d4', // Cyan 500
    primaryDark: '#0e7490',  // Cyan 700
    secondary: '#0284c7',    // Sky 600
    accent: '#f472b6',       // Pink 400
    background: '#ffffff',
    surface: '#ecfeff',      // Cyan 50
    border: '#a5f3fc',       // Cyan 200
    text: '#164e63',         // Cyan 900
    textMuted: '#6b7280',
    textInverse: '#ffffff',
    success: '#14b8a6',      // Teal 500
    warning: '#f59e0b',
    error: '#f43f5e',        // Rose 500
    info: '#06b6d4',
  },

  // Luxury - premium, elegant, exclusive
  luxury: {
    name: 'Luxury',
    primary: '#7c3aed',      // Violet 600
    primaryLight: '#8b5cf6', // Violet 500
    primaryDark: '#6d28d9',  // Violet 700
    secondary: '#c084fc',    // Purple 400
    accent: '#fbbf24',       // Amber 400 (gold)
    background: '#faf5ff',   // Purple 50
    surface: '#f3e8ff',      // Purple 100
    border: '#e9d5ff',       // Purple 200
    text: '#2e1065',         // Purple 950
    textMuted: '#6b21a8',    // Purple 800
    textInverse: '#ffffff',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#8b5cf6',
  },
};

// Palette names list for AI reference
export const PALETTE_NAMES = Object.keys(PALETTES);

// Get a palette by name
export function getPalette(name) {
  return PALETTES[name] || PALETTES.modern;
}

// Get color from palette
export function getColor(paletteName, colorKey) {
  const palette = getPalette(paletteName);
  return palette[colorKey] || palette.primary;
}

// Format palette for AI prompt
export function formatPaletteForPrompt(name) {
  const p = getPalette(name);
  return `${p.name}: primary=${p.primary}, secondary=${p.secondary}, accent=${p.accent}, bg=${p.background}, surface=${p.surface}, text=${p.text}`;
}

// Get all palettes formatted for AI
export function getAllPalettesForPrompt() {
  return PALETTE_NAMES.map(name => {
    const p = PALETTES[name];
    return `- ${name}: primary=${p.primary}, accent=${p.accent}, bg=${p.background}, text=${p.text}`;
  }).join('\n');
}
