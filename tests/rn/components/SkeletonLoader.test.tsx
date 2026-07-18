import React from 'react';
import { render } from '@testing-library/react-native';
import { SkeletonLoader, SkeletonTorrentCard } from '@/components/SkeletonLoader';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

describe('SkeletonLoader', () => {
  it('renders with default props', async () => {
    const { toJSON } = await render(<SkeletonLoader />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom width/height/borderRadius/style', async () => {
    const { toJSON } = await render(
      <SkeletonLoader width={100} height={40} borderRadius={10} style={{ marginTop: 4 }} />
    );
    expect(toJSON()).toBeTruthy();
  });
});

describe('SkeletonTorrentCard', () => {
  it('renders without crashing', async () => {
    const { toJSON } = await render(<SkeletonTorrentCard />);
    expect(toJSON()).toBeTruthy();
  });
});
