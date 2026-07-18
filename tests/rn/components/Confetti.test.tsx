import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Confetti } from '@/components/Confetti';

describe('Confetti', () => {
  it('renders nothing when inactive', async () => {
    const { toJSON } = await render(<Confetti active={false} />);
    expect(toJSON()).toBeNull();
  });

  it('renders confetti pieces when active', async () => {
    const { toJSON } = await render(<Confetti active />);
    const json = toJSON();
    expect(json).toBeTruthy();
  });

  it('accepts a custom duration', async () => {
    const { toJSON } = await render(<Confetti active duration={500} />);
    expect(toJSON()).toBeTruthy();
  });

  it('re-renders from inactive to active', async () => {
    const { rerender, toJSON } = await render(<Confetti active={false} />);
    expect(toJSON()).toBeNull();
    await act(async () => {
      rerender(<Confetti active />);
    });
    expect(toJSON()).toBeTruthy();
  });
});
