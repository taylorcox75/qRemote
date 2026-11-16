import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { CategoryModal } from '@/components/CategoryModal';

jest.mock('@/context/ThemeContext', () => require('@/tests/rn/components/cov/mocks').themeModule);
jest.mock('react-i18next', () => require('@/tests/rn/components/cov/mocks').i18nModule);

function setup(overrides: Partial<React.ComponentProps<typeof CategoryModal>> = {}) {
  const props = {
    visible: true,
    currentCategory: 'movies',
    allCategories: ['movies', 'tv', 'music'],
    onSelect: jest.fn().mockResolvedValue(undefined),
    onCreateAndSelect: jest.fn().mockResolvedValue(undefined),
    onClose: jest.fn(),
    ...overrides,
  };
  return { props, view: render(<CategoryModal {...props} />) };
}

describe('CategoryModal', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows the current category and the other categories', async () => {
    await setup().view;
    expect(screen.getByText('movies')).toBeTruthy();
    expect(screen.getByText('tv')).toBeTruthy();
    expect(screen.getByText('music')).toBeTruthy();
    expect(screen.getAllByText('movies')).toHaveLength(1);
  });

  it('shows the none hint without a current category', async () => {
    await setup({ currentCategory: '', allCategories: [] }).view;
    expect(screen.getByText('common.none')).toBeTruthy();
    expect(screen.queryByLabelText('common.remove')).toBeNull();
  });

  it('clears the category from the current chip', async () => {
    const { props, view } = setup();
    await view;
    await fireEvent.press(screen.getByLabelText('common.remove'));
    await waitFor(() => expect(props.onSelect).toHaveBeenCalledWith(''));
  });

  it('selects another category', async () => {
    const { props, view } = setup();
    await view;
    await fireEvent.press(screen.getByText('tv'));
    await waitFor(() => expect(props.onSelect).toHaveBeenCalledWith('tv'));
  });

  it('creates and selects a trimmed new category', async () => {
    const { props, view } = setup();
    await view;
    const input = screen.getByPlaceholderText('torrentDetail.enterCategoryName');
    await fireEvent.changeText(input, '  books ');
    await fireEvent.press(screen.getByLabelText('screens.settings.addCategory'));
    await waitFor(() => expect(props.onCreateAndSelect).toHaveBeenCalledWith('books'));
    await waitFor(() => expect(input.props.value).toBe(''));
  });

  it('does nothing for a blank new category', async () => {
    const { props, view } = setup();
    await view;
    const input = screen.getByPlaceholderText('torrentDetail.enterCategoryName');
    await fireEvent.changeText(input, '  ');
    await fireEvent(input, 'submitEditing');
    expect(props.onCreateAndSelect).not.toHaveBeenCalled();
  });

  it('confirms deletion on long-press and calls onDeleteCategory', async () => {
    const onDeleteCategory = jest.fn().mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await setup({ onDeleteCategory }).view;
    await fireEvent(screen.getByText('music'), 'longPress');
    expect(alertSpy.mock.calls[0][0]).toBe('alerts.deleteCategory(name=music)');
    const buttons = alertSpy.mock.calls[0][2] as {
      style?: string;
      onPress?: () => Promise<void>;
    }[];
    expect(buttons[1].style).toBe('destructive');
    await buttons[1].onPress!();
    expect(onDeleteCategory).toHaveBeenCalledWith('music');
  });

  it('closes via the close button', async () => {
    const { props, view } = setup();
    await view;
    await fireEvent.press(screen.getByLabelText('common.close'));
    expect(props.onClose).toHaveBeenCalled();
  });
});
