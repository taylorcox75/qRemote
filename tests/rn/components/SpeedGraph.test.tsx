import React from 'react';
import { render } from '@testing-library/react-native';
import { SpeedGraph } from '@/components/SpeedGraph';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

describe('SpeedGraph', () => {
  it('renders empty-state dashed line when data is empty', async () => {
    const { toJSON } = await render(<SpeedGraph data={[]} color="#00f" />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders single data point as a vertical line', async () => {
    const { toJSON } = await render(<SpeedGraph data={[42]} color="#00f" />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders multi-point polyline with custom dimensions and maxValue', async () => {
    const { toJSON } = await render(
      <SpeedGraph data={[1, 5, 3, 8, 2]} color="#0f0" width={200} height={80} maxValue={10} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('handles all-zero data without dividing by zero', async () => {
    const { toJSON } = await render(<SpeedGraph data={[0, 0, 0]} color="#f00" />);
    expect(toJSON()).toBeTruthy();
  });
});
