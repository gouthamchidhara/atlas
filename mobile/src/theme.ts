// Design tokens mirrored from the web app so the native UI matches 1:1.
export type Scheme = 'light' | 'dark'

type Palette = {
  ink: string
  ink2: string
  ink3: string
  accent: string
  positive: string
  warn: string
  critical: string
  glass: string
  glassStrong: string
  hairline: string
  hairlineStrong: string
  appBg: string
  btnFill: string
  btnText: string
  track: string
  trackActive: string
  tabActive: string
  blurTint: 'light' | 'dark'
  mapDark: boolean
}

export const palettes: Record<Scheme, Palette> = {
  light: {
    ink: '#2a2f3a',
    ink2: '#5b6270',
    ink3: '#8a909c',
    accent: '#4c5df0',
    positive: '#1e9e6a',
    warn: '#e4791b',
    critical: '#e5484d',
    glass: 'rgba(255,255,255,0.80)',
    glassStrong: 'rgba(255,255,255,0.92)',
    hairline: 'rgba(16,18,27,0.08)',
    hairlineStrong: 'rgba(16,18,27,0.12)',
    appBg: '#e9edf2',
    btnFill: '#0b1220',
    btnText: '#ffffff',
    track: 'rgba(16,18,27,0.05)',
    trackActive: '#ffffff',
    tabActive: 'rgba(17,20,28,0.08)',
    blurTint: 'light',
    mapDark: false,
  },
  dark: {
    ink: '#f2f4f8',
    ink2: '#a6adbb',
    ink3: '#757c8a',
    accent: '#6e86ff',
    positive: '#3fbF87',
    warn: '#f2a35d',
    critical: '#ff6b6b',
    glass: 'rgba(24,26,32,0.72)',
    glassStrong: 'rgba(30,32,38,0.90)',
    hairline: 'rgba(255,255,255,0.10)',
    hairlineStrong: 'rgba(255,255,255,0.16)',
    appBg: '#0b0d12',
    btnFill: '#f3f5f9',
    btnText: '#0b1220',
    track: 'rgba(255,255,255,0.06)',
    trackActive: 'rgba(255,255,255,0.16)',
    tabActive: 'rgba(255,255,255,0.14)',
    blurTint: 'dark',
    mapDark: true,
  },
}

export const spacing = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32 }
export const radius = { pill: 999, card: 20, sheet: 28, chip: 14 }

export const font = {
  // Avenir Next is native on iOS; Android falls back gracefully to the system sans.
  family: 'Avenir Next',
  display: 34,
  title1: 26,
  title2: 21,
  headline: 17,
  body: 16,
  subhead: 13,
  caption: 12,
  wRegular: '400' as const,
  wMedium: '500' as const,
  wSemibold: '600' as const,
  wBold: '700' as const,
}
