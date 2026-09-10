import { Platform, useWindowDimensions } from 'react-native';

export type LayoutIdiom = 'compact' | 'regular' | 'mac';

export const REGULAR_MIN_WIDTH = 700;

export function getLayoutIdiom(width: number, isPad: boolean, isMacCatalyst: boolean): LayoutIdiom {
  if (isMacCatalyst) {
    return 'mac';
  }
  if (isPad && width >= REGULAR_MIN_WIDTH) {
    return 'regular';
  }
  return 'compact';
}

export function useLayoutIdiom(): LayoutIdiom {
  const { width } = useWindowDimensions();
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const isMacCatalyst = Platform.OS === 'ios' && (Platform.isMacCatalyst ?? false);
  return getLayoutIdiom(width, isPad, isMacCatalyst);
}
