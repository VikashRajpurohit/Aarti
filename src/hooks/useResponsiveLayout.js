import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacingSizes, sizes } from '../theme/responsive';

// The single source of truth for layout decisions (tablet detection, grid
// columns, content width, tab-bar clearance). Reacts to rotation/resizes —
// screens must use this instead of module-scope Dimensions.get('window').
export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isTablet = Math.min(width, height) >= 600;
  const isLandscape = width > height;
  const columns = width >= 1000 ? 3 : width >= 700 ? 2 : 1;
  const contentMaxWidth = isTablet ? 760 : width;
  const horizontalPadding = isTablet ? spacingSizes.xxl : spacingSizes.lg;
  // Must match the custom bottom bar's height in BottomNav.js.
  const tabBarHeight = sizes.tabBarBase + Math.max(insets.bottom, spacingSizes.sm);
  const scrollBottomPadding = tabBarHeight + spacingSizes.xl;

  return {
    width,
    height,
    isTablet,
    isLandscape,
    columns,
    contentMaxWidth,
    horizontalPadding,
    tabBarHeight,
    scrollBottomPadding,
    insets,
  };
}
