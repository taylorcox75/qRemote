import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, screen, act } from '@testing-library/react-native';
import { AnimatedButton } from '@/components/AnimatedButton';

describe('AnimatedButton', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders children', async () => {
    await render(
      <AnimatedButton>
        <Text>Press me</Text>
      </AnimatedButton>
    );
    expect(screen.getByText('Press me')).toBeTruthy();
  });

  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    await render(
      <AnimatedButton onPress={onPress}>
        <Text>Tap</Text>
      </AnimatedButton>
    );
    fireEvent.press(screen.getByText('Tap'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('handles pressIn/pressOut animation without crashing', async () => {
    jest.useFakeTimers();
    await render(
      <AnimatedButton scaleValue={0.9}>
        <Text>Anim</Text>
      </AnimatedButton>
    );
    const el = screen.getByText('Anim');
    await act(async () => {
      fireEvent(el, 'pressIn');
      fireEvent(el, 'pressOut');
      jest.runAllTimers();
    });
    expect(el).toBeTruthy();
  });

  it('does not animate when disabled', async () => {
    const onPress = jest.fn();
    await render(
      <AnimatedButton disabled onPress={onPress}>
        <Text>Disabled</Text>
      </AnimatedButton>
    );
    const el = screen.getByText('Disabled');
    fireEvent(el, 'pressIn');
    fireEvent(el, 'pressOut');
    fireEvent.press(el);
    expect(onPress).not.toHaveBeenCalled();
  });
});
