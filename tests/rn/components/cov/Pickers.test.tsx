import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { OptionPicker } from '@/components/OptionPicker';
import { MultiSelectPicker } from '@/components/MultiSelectPicker';

jest.mock('@/context/ThemeContext', () => require('@/tests/rn/components/cov/mocks').themeModule);
jest.mock('react-i18next', () => require('@/tests/rn/components/cov/mocks').i18nModule);

const options = [
  { label: 'Name', value: 'name', icon: 'text-outline' as const },
  { label: 'Size', value: 'size' },
  { label: 'Date', value: 'date' },
];

const layout = (height: number) => ({
  nativeEvent: { layout: { x: 0, y: 0, width: 280, height } },
});

function menu() {
  const el = screen.getAllByLabelText(/^(Sort by|Columns)$/).find((e) => e.props.onLayout);
  if (!el) throw new Error('menu container not found');
  return el;
}

function menuTop() {
  const style = [menu().props.style].flat(Infinity) as { top?: number }[];
  return style.reduce<number | undefined>(
    (acc, s) => (s && s.top !== undefined ? s.top : acc),
    undefined,
  );
}

describe('OptionPicker', () => {
  function renderPicker(selectedValue?: string) {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const view = render(
      <OptionPicker
        visible
        title="Sort by"
        options={options}
        selectedValue={selectedValue}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    return { view, onSelect, onClose };
  }

  it('renders options and marks the selected one', async () => {
    const { view } = renderPicker('size');
    await view;
    expect(screen.getByText('Sort by')).toBeTruthy();
    expect(screen.getByLabelText('Size').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByLabelText('Name').props.accessibilityState).toEqual({ selected: false });
  });

  it('selecting an option reports it and closes', async () => {
    const { view, onSelect, onClose } = renderPicker('size');
    await view;
    await fireEvent.press(screen.getByLabelText('Date'));
    expect(onSelect).toHaveBeenCalledWith('date');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the close button and the backdrop', async () => {
    const { view, onClose } = renderPicker();
    await view;
    await fireEvent.press(screen.getByLabelText('common.close'));
    await fireEvent.press(screen.getByLabelText('Close picker'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps a tall menu within the screen after layout, adjusting only once', async () => {
    const { view } = renderPicker();
    await view;
    const before = menuTop()!;
    await fireEvent(menu(), 'layout', layout(5000));
    const after = menuTop()!;
    expect(after).not.toBe(before);
    expect(after).toBeGreaterThanOrEqual(16);
    await fireEvent(menu(), 'layout', layout(100));
    expect(menuTop()).toBe(after);
  });

  it('ignores a zero-height layout', async () => {
    const { view } = renderPicker();
    await view;
    const before = menuTop();
    await fireEvent(menu(), 'layout', layout(0));
    expect(menuTop()).toBe(before);
  });
});

describe('MultiSelectPicker', () => {
  function renderPicker(selectedValues: string[]) {
    const onChange = jest.fn();
    const onClose = jest.fn();
    const view = render(
      <MultiSelectPicker
        visible
        title="Columns"
        options={options}
        selectedValues={selectedValues}
        onChange={onChange}
        onClose={onClose}
      />,
    );
    return { view, onChange, onClose };
  }

  it('adds an unselected value', async () => {
    const { view, onChange, onClose } = renderPicker(['name']);
    await view;
    await fireEvent.press(screen.getByLabelText('Size'));
    expect(onChange).toHaveBeenCalledWith(['name', 'size']);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes a selected value', async () => {
    const { view, onChange } = renderPicker(['name', 'size']);
    await view;
    expect(screen.getByLabelText('Name').props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(screen.getByLabelText('Name'));
    expect(onChange).toHaveBeenCalledWith(['size']);
  });

  it('closes from the close button and the backdrop', async () => {
    const { view, onClose } = renderPicker([]);
    await view;
    await fireEvent.press(screen.getByLabelText('common.close'));
    const backdrop = screen.queryByLabelText('Close picker');
    if (backdrop) await fireEvent.press(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('repositions a tall menu after layout', async () => {
    const { view } = renderPicker([]);
    await view;
    const before = menuTop()!;
    await fireEvent(menu(), 'layout', layout(5000));
    expect(menuTop()).not.toBe(before);
    expect(menuTop()).toBeGreaterThanOrEqual(16);
  });
});
