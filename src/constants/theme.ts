/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    accent: '#1570D1',
    onAccent: '#ffffff',
    warning: '#C2410C',
    accentSoft: '#E3EFFC',
    border: '#DCDDE3',
    hero: '#123F7D',
    onHero: '#ffffff',
    onHeroMuted: '#C5D9F4',
    grammarLabel: '#124C8C',
    grammarText: '#0B2545',
    grammarMuted: '#2B4A6F',
    grammarLine: '#B9D3F3',
    markA: '#8A3B0A',
    markABg: '#FDE8D3',
    markB: '#0F4C8F',
    markBBg: '#D6E6FB',
    /** Highlight for words guessed from a photo of handwriting. */
    guessBg: '#FFE27A',
    /** "We found each other!" and other done / ready states. */
    success: '#1A8F52',
    onSuccess: '#ffffff',
    successSoft: '#E3F5EA',
    successText: '#14653D',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    accent: '#4BA3F5',
    onAccent: '#00111F',
    warning: '#FB923C',
    accentSoft: '#11263D',
    border: '#34373C',
    hero: '#0F3264',
    onHero: '#ffffff',
    onHeroMuted: '#B4CCEE',
    grammarLabel: '#9CC5F5',
    grammarText: '#EAF2FC',
    grammarMuted: '#B4CCEE',
    grammarLine: '#24456E',
    markA: '#FDBA74',
    markABg: '#3D2410',
    markB: '#93C5FD',
    markBBg: '#132F55',
    guessBg: '#6B5400',
    success: '#2FBF71',
    onSuccess: '#00140A',
    successSoft: '#0F2E1E',
    successText: '#7EE2A8',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;
