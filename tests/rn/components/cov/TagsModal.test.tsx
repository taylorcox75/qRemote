import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { TagsModal } from '@/components/TagsModal';

jest.mock('@/context/ThemeContext', () => require('@/tests/rn/components/cov/mocks').themeModule);
jest.mock('react-i18next', () => require('@/tests/rn/components/cov/mocks').i18nModule);

function setup(overrides: Partial<React.ComponentProps<typeof TagsModal>> = {}) {
  const props = {
    visible: true,
    currentTagsCsv: 'movies, hd',
    allServerTags: ['movies', 'hd', 'tv', 'music'],
    onAddTag: jest.fn().mockResolvedValue(undefined),
    onRemoveTag: jest.fn().mockResolvedValue(undefined),
    onClose: jest.fn(),
    ...overrides,
  };
  return { props, view: render(<TagsModal {...props} />) };
}

describe('TagsModal', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows assigned tags and only unassigned server tags as add chips', async () => {
    const { view } = setup();
    await view;
    expect(screen.getByText('movies')).toBeTruthy();
    expect(screen.getByText('hd')).toBeTruthy();
    expect(screen.getByText('tv')).toBeTruthy();
    expect(screen.getByText('music')).toBeTruthy();
    expect(screen.getAllByLabelText('common.remove')).toHaveLength(2);
  });

  it('shows the empty hint when nothing is assigned and hides the library when all are assigned', async () => {
    const { view } = setup({ currentTagsCsv: '', allServerTags: [] });
    await view;
    expect(screen.getByText('common.none')).toBeTruthy();
    expect(screen.queryByText('TORRENTDETAIL.SECTIONADDFROMLIBRARY')).toBeNull();
  });

  it('removes an assigned tag', async () => {
    const { props, view } = setup();
    await view;
    await fireEvent.press(screen.getAllByLabelText('common.remove')[1]);
    await waitFor(() => expect(props.onRemoveTag).toHaveBeenCalledWith('hd'));
  });

  it('adds a library tag', async () => {
    const { props, view } = setup();
    await view;
    await fireEvent.press(screen.getByText('tv'));
    await waitFor(() => expect(props.onAddTag).toHaveBeenCalledWith('tv'));
  });

  it('creates a new tag via onCreateTag with trimmed input and clears the field', async () => {
    const onCreateTag = jest.fn().mockResolvedValue(undefined);
    const { props, view } = setup({ onCreateTag });
    await view;
    const input = screen.getByPlaceholderText('screens.settings.tagName');
    await fireEvent.changeText(input, '  anime  ');
    await fireEvent.press(screen.getByLabelText('screens.settings.createTag'));
    await waitFor(() => expect(onCreateTag).toHaveBeenCalledWith('anime'));
    expect(props.onAddTag).not.toHaveBeenCalled();
    await waitFor(() => expect(input.props.value).toBe(''));
  });

  it('falls back to onAddTag when onCreateTag is absent (submit via keyboard)', async () => {
    const { props, view } = setup();
    await view;
    const input = screen.getByPlaceholderText('screens.settings.tagName');
    await fireEvent.changeText(input, 'new');
    await fireEvent(input, 'submitEditing');
    await waitFor(() => expect(props.onAddTag).toHaveBeenCalledWith('new'));
  });

  it('ignores a blank new tag', async () => {
    const { props, view } = setup();
    await view;
    const input = screen.getByPlaceholderText('screens.settings.tagName');
    await fireEvent.changeText(input, '   ');
    await fireEvent(input, 'submitEditing');
    expect(props.onAddTag).not.toHaveBeenCalled();
  });

  it('confirms and deletes a library tag on long-press', async () => {
    const onDeleteTag = jest.fn().mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { view } = setup({ onDeleteTag });
    await view;
    expect(screen.getByText('torrentDetail.longPressToDelete')).toBeTruthy();
    await fireEvent(screen.getByText('music'), 'longPress');
    expect(alertSpy).toHaveBeenCalledWith(
      'alerts.deleteTag(tag=music)',
      'alerts.deleteTagMessage',
      expect.any(Array),
    );
    const buttons = alertSpy.mock.calls[0][2] as { onPress?: () => Promise<void> }[];
    await buttons[1].onPress!();
    expect(onDeleteTag).toHaveBeenCalledWith('music');
  });

  it('closes from the header button', async () => {
    const { props, view } = setup();
    await view;
    await fireEvent.press(screen.getByLabelText('common.close'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('disables the create button while loading', async () => {
    const { view } = setup({ loading: true });
    await view;
    const btn = screen.getByLabelText('screens.settings.createTag');
    expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBe(true);
  });
});
