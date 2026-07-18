import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { FilterChip } from '@/components/FilterChip';
import { mockColors } from './theme-mock';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: require('./theme-mock').mockColors }),
}));

describe('FilterChip', () => {
  it('renders label, inactive by default styling', async () => {
    await render(<FilterChip label="All" active={false} onPress={jest.fn()} />);
    expect(screen.getByText('All')).toBeTruthy();
  });

  it('renders active state', async () => {
    await render(<FilterChip label="Active" active onPress={jest.fn()} />);
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    await render(<FilterChip label="Tap" active={false} onPress={onPress} />);
    fireEvent.press(screen.getByText('Tap'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders icon when provided', async () => {
    await render(<FilterChip label="Icon" active onPress={jest.fn()} icon="add" />);
    expect(screen.getByText('Icon')).toBeTruthy();
  });

  it('renders children', async () => {
    await render(
      <FilterChip label="WithChild" active={false} onPress={jest.fn()}>
        <Text>child-content</Text>
      </FilterChip>
    );
    expect(screen.getByText('child-content')).toBeTruthy();
  });

  it('uses custom activeColor and accessibility props', async () => {
    await render(
      <FilterChip
        label="Custom"
        active
        onPress={jest.fn()}
        activeColor="#123456"
        accessibilityLabel="custom-chip"
        accessibilityState={{ selected: true }}
        numberOfLines={1}
      />
    );
    expect(screen.getByLabelText('custom-chip')).toBeTruthy();
  });
});
