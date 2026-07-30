import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { SavePathPickerModal } from '@/components/SavePathPickerModal';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      text: '#000',
      textSecondary: '#666',
      surfaceOutline: '#ccc',
      primary: '#007aff',
      background: '#fff',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('SavePathPickerModal', () => {
  it('renders nothing when not visible', async () => {
    await render(
      <SavePathPickerModal
        visible={false}
        paths={['/data/movies']}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByText('/data/movies')).toBeNull();
  });

  it('lists every given path when visible', async () => {
    await render(
      <SavePathPickerModal
        visible
        paths={['/data/movies', '/data/tv']}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('/data/movies')).toBeTruthy();
    expect(screen.getByText('/data/tv')).toBeTruthy();
  });

  it('shows the empty state when there are no known paths', async () => {
    await render(
      <SavePathPickerModal visible paths={[]} onSelect={jest.fn()} onClose={jest.fn()} />,
    );
    expect(screen.getByText('savePathPicker.empty')).toBeTruthy();
  });

  it('filters the list by the typed query', async () => {
    await render(
      <SavePathPickerModal
        visible
        paths={['/data/movies', '/data/tv']}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText('savePathPicker.filterPlaceholder'),
      'movies',
    );
    expect(screen.getByText('/data/movies')).toBeTruthy();
    expect(screen.queryByText('/data/tv')).toBeNull();
  });

  it('shows the no-matches state when the filter matches nothing', async () => {
    await render(
      <SavePathPickerModal
        visible
        paths={['/data/movies']}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText('savePathPicker.filterPlaceholder'),
      'nonexistent',
    );
    expect(screen.getByText('savePathPicker.noMatches')).toBeTruthy();
  });

  it('calls onSelect and onClose when a row is tapped', async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    await render(
      <SavePathPickerModal
        visible
        paths={['/data/movies']}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    await fireEvent.press(screen.getByText('/data/movies'));
    expect(onSelect).toHaveBeenCalledWith('/data/movies');
    expect(onClose).toHaveBeenCalled();
  });
});
