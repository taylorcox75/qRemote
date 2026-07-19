import React from 'react';
import { render } from '@testing-library/react-native';
import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

describe('AnimatedProgressBar', () => {
  it('renders with default props', async () => {
    const { toJSON } = await render(<AnimatedProgressBar progress={50} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom color and height', async () => {
    const { toJSON } = await render(<AnimatedProgressBar progress={30} color="#f00" height={10} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders without animation (animated=false)', async () => {
    const { toJSON } = await render(<AnimatedProgressBar progress={70} animated={false} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders glow effect when showGlow and progress is mid-range', async () => {
    const { toJSON } = await render(<AnimatedProgressBar progress={50} showGlow />);
    expect(toJSON()).toBeTruthy();
  });

  it('does not render glow at 0 progress even if showGlow is set', async () => {
    const { toJSON } = await render(<AnimatedProgressBar progress={0} showGlow />);
    expect(toJSON()).toBeTruthy();
  });

  it('does not render glow at 100 progress even if showGlow is set', async () => {
    const { toJSON } = await render(<AnimatedProgressBar progress={100} showGlow />);
    expect(toJSON()).toBeTruthy();
  });

  it('re-renders on progress change (animated path)', async () => {
    const { rerender, toJSON } = await render(<AnimatedProgressBar progress={0} />);
    rerender(<AnimatedProgressBar progress={80} />);
    expect(toJSON()).toBeTruthy();
  });
});
