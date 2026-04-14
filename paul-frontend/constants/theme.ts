/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#0A1F2E',          // deep navy (better than black)
    background: '#F4F8FB',    // soft light blue background
    tint: '#0076B6',          // Honolulu Blue (MAIN brand color)
    icon: '#6C7A86',          // muted blue-gray instead of dull gray
    tabIconDefault: '#6C7A86',
    tabIconSelected: '#0076B6', // active = Lions blue
  },
  dark: {
    text: '#EAF4FA',          // soft white/blue (easy on eyes)
    background: '#0A1F2E',    // deep navy (main background)
    tint: '#0076B6',          // Honolulu Blue (primary)
    icon: '#8FA3B0',          // muted blue-gray icons
    tabIconDefault: '#8FA3B0',
    tabIconSelected: '#4FC3F7', // brighter blue for active tabs
  }
};

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
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
