import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { SearchCartModal } from '@/components/SearchCartModal';
import { SearchCartItem } from '@/context/SearchCartContext';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      text: '#000',
      textSecondary: '#666',
      surfaceOutline: '#ccc',
      primary: '#007aff',
      background: '#fff',
      success: '#34c759',
      error: '#ff3b30',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const itemA: SearchCartItem = {
  fileUrl: 'magnet:?xt=urn:btih:AAA',
  fileName: 'Result A',
  fileSize: 1024,
  nbSeeders: 10,
  indexerLabel: 'IndexerA',
};

const itemB: SearchCartItem = {
  fileUrl: 'magnet:?xt=urn:btih:BBB',
  fileName: 'Result B',
  fileSize: 2048,
  nbSeeders: 5,
  indexerLabel: 'IndexerB',
};

describe('SearchCartModal', () => {
  it('renders nothing when not visible', async () => {
    await render(
      <SearchCartModal
        visible={false}
        items={[itemA]}
        onRemove={jest.fn()}
        onClearAll={jest.fn()}
        onCheckout={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByText('Result A')).toBeNull();
  });

  it('lists every queued item when visible', async () => {
    await render(
      <SearchCartModal
        visible
        items={[itemA, itemB]}
        onRemove={jest.fn()}
        onClearAll={jest.fn()}
        onCheckout={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('Result A')).toBeTruthy();
    expect(screen.getByText('Result B')).toBeTruthy();
  });

  it('shows the empty state when the cart has no items', async () => {
    await render(
      <SearchCartModal
        visible
        items={[]}
        onRemove={jest.fn()}
        onClearAll={jest.fn()}
        onCheckout={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('screens.search.cartEmpty')).toBeTruthy();
  });

  it("calls onRemove with the tapped item's fileUrl", async () => {
    const onRemove = jest.fn();
    await render(
      <SearchCartModal
        visible
        items={[itemA, itemB]}
        onRemove={onRemove}
        onClearAll={jest.fn()}
        onCheckout={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    const removeButtons = screen.getAllByLabelText('common.remove');
    await fireEvent.press(removeButtons[0]);
    expect(onRemove).toHaveBeenCalledWith(itemA.fileUrl);
  });

  it('calls onClearAll when Clear all is tapped', async () => {
    const onClearAll = jest.fn();
    await render(
      <SearchCartModal
        visible
        items={[itemA]}
        onRemove={jest.fn()}
        onClearAll={onClearAll}
        onCheckout={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByText('screens.search.cartClearAll'));
    expect(onClearAll).toHaveBeenCalled();
  });

  it('calls onCheckout when Checkout is tapped', async () => {
    const onCheckout = jest.fn();
    await render(
      <SearchCartModal
        visible
        items={[itemA]}
        onRemove={jest.fn()}
        onClearAll={jest.fn()}
        onCheckout={onCheckout}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByText('screens.search.cartCheckout'));
    expect(onCheckout).toHaveBeenCalled();
  });

  it('calls onClose when the backdrop is tapped', async () => {
    const onClose = jest.fn();
    await render(
      <SearchCartModal
        visible
        items={[itemA]}
        onRemove={jest.fn()}
        onClearAll={jest.fn()}
        onCheckout={jest.fn()}
        onClose={onClose}
      />,
    );
    await fireEvent.press(screen.getByLabelText('common.close'));
    expect(onClose).toHaveBeenCalled();
  });
});
