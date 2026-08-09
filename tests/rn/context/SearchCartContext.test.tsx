import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react-native';
import { SearchCartProvider, useSearchCart, SearchCartItem } from '@/context/SearchCartContext';

const itemA: SearchCartItem = {
  fileUrl: 'magnet:?xt=urn:btih:AAA',
  fileName: 'Result A',
  fileSize: 100,
  nbSeeders: 10,
  indexerLabel: 'IndexerA',
};

const itemB: SearchCartItem = {
  fileUrl: 'magnet:?xt=urn:btih:BBB',
  fileName: 'Result B',
  fileSize: 200,
  nbSeeders: 20,
  indexerLabel: 'IndexerB',
};

function Consumer() {
  const { items, count, has, add, remove, toggle, clear } = useSearchCart();
  return (
    <>
      <Text testID="count">{count}</Text>
      <Text testID="order">{items.map((item) => item.fileUrl).join(',')}</Text>
      <Text testID="has-a">{has(itemA.fileUrl) ? 'yes' : 'no'}</Text>
      <TouchableOpacity testID="add-a" onPress={() => add(itemA)} />
      <TouchableOpacity testID="add-b" onPress={() => add(itemB)} />
      <TouchableOpacity testID="remove-a" onPress={() => remove(itemA.fileUrl)} />
      <TouchableOpacity testID="toggle-a" onPress={() => toggle(itemA)} />
      <TouchableOpacity testID="clear" onPress={clear} />
    </>
  );
}

describe('SearchCartContext', () => {
  it('throws when useSearchCart used outside provider', async () => {
    const Bad = () => {
      useSearchCart();
      return null;
    };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Bad />)).rejects.toThrow(
      'useSearchCart must be used within a SearchCartProvider',
    );
    spy.mockRestore();
  });

  it('starts empty', async () => {
    await render(
      <SearchCartProvider>
        <Consumer />
      </SearchCartProvider>,
    );
    expect(screen.getByTestId('count').props.children).toBe(0);
    expect(screen.getByTestId('has-a').props.children).toBe('no');
  });

  it('add() dedupes by fileUrl and preserves insertion order', async () => {
    await render(
      <SearchCartProvider>
        <Consumer />
      </SearchCartProvider>,
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-b'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-a'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-a'));
    });
    await waitFor(() => expect(screen.getByTestId('count').props.children).toBe(2));
    expect(screen.getByTestId('order').props.children).toBe(`${itemB.fileUrl},${itemA.fileUrl}`);
    expect(screen.getByTestId('has-a').props.children).toBe('yes');
  });

  it('remove() drops the item', async () => {
    await render(
      <SearchCartProvider>
        <Consumer />
      </SearchCartProvider>,
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-a'));
    });
    await waitFor(() => expect(screen.getByTestId('count').props.children).toBe(1));

    await act(async () => {
      fireEvent.press(screen.getByTestId('remove-a'));
    });
    await waitFor(() => expect(screen.getByTestId('count').props.children).toBe(0));
    expect(screen.getByTestId('has-a').props.children).toBe('no');
  });

  it('toggle() flips membership both ways', async () => {
    await render(
      <SearchCartProvider>
        <Consumer />
      </SearchCartProvider>,
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('toggle-a'));
    });
    await waitFor(() => expect(screen.getByTestId('has-a').props.children).toBe('yes'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('toggle-a'));
    });
    await waitFor(() => expect(screen.getByTestId('has-a').props.children).toBe('no'));
  });

  it('clear() empties the cart', async () => {
    await render(
      <SearchCartProvider>
        <Consumer />
      </SearchCartProvider>,
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-a'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-b'));
    });
    await waitFor(() => expect(screen.getByTestId('count').props.children).toBe(2));

    await act(async () => {
      fireEvent.press(screen.getByTestId('clear'));
    });
    await waitFor(() => expect(screen.getByTestId('count').props.children).toBe(0));
  });
});
