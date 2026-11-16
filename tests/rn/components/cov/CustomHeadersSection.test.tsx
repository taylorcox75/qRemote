import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { CustomHeadersSection } from '@/components/CustomHeadersSection';

jest.mock('@/context/ThemeContext', () => require('@/tests/rn/components/cov/mocks').themeModule);
jest.mock('react-i18next', () => require('@/tests/rn/components/cov/mocks').i18nModule);

function renderSection(props: Partial<React.ComponentProps<typeof CustomHeadersSection>> = {}) {
  const onUseCustomHeadersChange = jest.fn();
  const onHeadersChange = jest.fn();
  const view = render(
    <CustomHeadersSection
      useCustomHeaders
      headers={[]}
      onUseCustomHeadersChange={onUseCustomHeadersChange}
      onHeadersChange={onHeadersChange}
      {...props}
    />,
  );
  return { view, onUseCustomHeadersChange, onHeadersChange };
}

describe('CustomHeadersSection', () => {
  it('hides header rows while the toggle is off', async () => {
    const { view } = renderSection({
      useCustomHeaders: false,
      headers: [{ key: 'a', value: 'b' }],
    });
    await view;
    expect(screen.queryByPlaceholderText('placeholders.headerName')).toBeNull();
    expect(screen.queryByText('server.addHeader')).toBeNull();
  });

  it('turning the toggle on with no headers seeds one empty row', async () => {
    const { view, onUseCustomHeadersChange, onHeadersChange } = renderSection({
      useCustomHeaders: false,
    });
    await view;
    await fireEvent(screen.getByRole('switch'), 'valueChange', true);
    expect(onUseCustomHeadersChange).toHaveBeenCalledWith(true);
    expect(onHeadersChange).toHaveBeenCalledWith([{ key: '', value: '' }]);
  });

  it('turning the toggle off does not touch existing headers', async () => {
    const { view, onUseCustomHeadersChange, onHeadersChange } = renderSection({
      headers: [{ key: 'X-A', value: '1' }],
    });
    await view;
    await fireEvent(screen.getByRole('switch'), 'valueChange', false);
    expect(onUseCustomHeadersChange).toHaveBeenCalledWith(false);
    expect(onHeadersChange).not.toHaveBeenCalled();
  });

  it('edits the key and value of the right row', async () => {
    const headers = [
      { key: 'X-A', value: '1' },
      { key: 'X-B', value: '2' },
    ];
    const { view, onHeadersChange } = renderSection({ headers });
    await view;
    await fireEvent.changeText(screen.getAllByPlaceholderText('placeholders.headerName')[1], 'X-C');
    expect(onHeadersChange).toHaveBeenLastCalledWith([
      { key: 'X-A', value: '1' },
      { key: 'X-C', value: '2' },
    ]);
    await fireEvent.changeText(
      screen.getAllByPlaceholderText('placeholders.headerValue')[0],
      'tok',
    );
    expect(onHeadersChange).toHaveBeenLastCalledWith([
      { key: 'X-A', value: 'tok' },
      { key: 'X-B', value: '2' },
    ]);
  });

  it('removes a row and adds a row', async () => {
    const headers = [
      { key: 'X-A', value: '1' },
      { key: 'X-B', value: '2' },
    ];
    const { view, onHeadersChange } = renderSection({ headers });
    await view;
    await fireEvent.press(screen.getAllByLabelText('server.removeHeader')[0]);
    expect(onHeadersChange).toHaveBeenLastCalledWith([{ key: 'X-B', value: '2' }]);
    await fireEvent.press(screen.getByText('server.addHeader'));
    expect(onHeadersChange).toHaveBeenLastCalledWith([...headers, { key: '', value: '' }]);
  });

  it('does not add beyond five headers', async () => {
    const headers = Array.from({ length: 5 }, (_, i) => ({ key: `X-${i}`, value: 'v' }));
    const { view, onHeadersChange } = renderSection({ headers });
    await view;
    await fireEvent.press(screen.getByText('server.addHeader'));
    expect(onHeadersChange).not.toHaveBeenCalled();
  });

  it('flags a reserved header name', async () => {
    const { view } = renderSection({ headers: [{ key: ' Authorization ', value: 'x' }] });
    await view;
    expect(screen.getByText('errors.reservedHeaderName(name=Authorization)')).toBeTruthy();
  });
});
