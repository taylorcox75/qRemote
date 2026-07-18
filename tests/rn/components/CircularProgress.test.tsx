import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CircularProgress } from '@/components/CircularProgress';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

describe('CircularProgress', () => {
  it('renders with limit=0 (no cap, percentage 0)', async () => {
    await render(<CircularProgress current={500} limit={0} color="#00f" />);
    expect(screen.getByText('0%')).toBeTruthy();
  });

  it('renders normal percentage under 80%', async () => {
    await render(<CircularProgress current={50} limit={100} color="#00f" />);
    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('renders warning color range 80-95%', async () => {
    await render(<CircularProgress current={85} limit={100} color="#00f" />);
    expect(screen.getByText('85%')).toBeTruthy();
  });

  it('renders error color range >=95%', async () => {
    await render(<CircularProgress current={99} limit={100} color="#00f" />);
    expect(screen.getByText('99%')).toBeTruthy();
  });

  it('clamps percentage to 100 when current exceeds limit', async () => {
    await render(<CircularProgress current={999} limit={100} color="#00f" />);
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('hides label when showLabel=false', async () => {
    await render(<CircularProgress current={10} limit={100} color="#00f" showLabel={false} />);
    expect(screen.queryByText('10%')).toBeNull();
  });

  it('supports custom size/strokeWidth', async () => {
    const { toJSON } = await render(
      <CircularProgress current={10} limit={100} color="#00f" size={100} strokeWidth={10} />
    );
    expect(toJSON()).toBeTruthy();
  });
});
