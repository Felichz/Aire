export const COLORS = {
    bg: '#08081a',
    bgMid: '#0e0e2a',
    bgBottom: '#0a0a1e',
    card: 'rgba(28, 28, 58, 0.75)',
    cardActive: 'rgba(37, 37, 77, 0.85)',
    cardBorder: 'rgba(255,255,255,0.12)',
    text: '#eeeef5',
    textPrimary: '#eeeef5', // Alias for modal compatibility
    textSecondary: 'rgba(238,238,245,0.50)',
    textMuted: 'rgba(238,238,245,0.22)',
    accent1: '#8b7cf8',   // Inhale  – soft violet
    accent2: '#e8a065',   // Hold    – warm amber
    accent3: '#5cc4c8',   // Exhale  – ocean teal
    glow1: 'rgba(139,124,248,0.28)',
    glow2: 'rgba(232,160,101,0.28)',
    glow3: 'rgba(92,196,200,0.28)',
    playBtn: '#8b7cf8',
    danger: '#f06e7e',
    glass: 'rgba(255,255,255,0.03)',
    glassBorder: 'rgba(255,255,255,0.06)',
};

export const PHASES = [
    { label: 'Inhale', icon: '🌸', accent: COLORS.accent1, glow: COLORS.glow1, defaultSeconds: 4 },
    { label: 'Hold', icon: '✨', accent: COLORS.accent2, glow: COLORS.glow2, defaultSeconds: 7 },
    { label: 'Exhale', icon: '🌬️🍃', accent: COLORS.accent3, glow: COLORS.glow3, defaultSeconds: 8 },
];

export const HEALTH_TIPS = [
    "Remember your posture!",
    "Take a sip of water.",
    "Relax your shoulders.",
    "Unclench your jaw.",
    "Rest your eyes for a moment.",
    "Take a deep breath.",
    "Remember to do some stretching!",
    "Eat your fruit!",
    "Remember to do some walking!"
];

export const MOODS = [
    { label: 'Stressed', emoji: '😫', value: 0 },
    { label: 'Neutral', emoji: '😐', value: 1 },
    { label: 'Calm', emoji: '😌', value: 2 },
];
