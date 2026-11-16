import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { ServerAppearanceSection } from '@/components/ServerAppearanceSection';
import { IconPicker } from '@/components/IconPicker';
import { ColorPicker } from '@/components/ColorPicker';
import { AVATAR_PALETTE } from '@/utils/server';
import { SERVER_ICON_OPTIONS } from '@/constants/serverIcons';

jest.mock('@/context/ThemeContext', () => require('@/tests/rn/components/cov/mocks').themeModule);
jest.mock('react-i18next', () => require('@/tests/rn/components/cov/mocks').i18nModule);

describe('IconPicker', () => {
  it('renders every icon option and reports the tapped one', async () => {
    const onIconChange = jest.fn();
    await render(
      <IconPicker
        visible
        currentIcon="server-outline"
        iconColor="#ff0000"
        onIconChange={onIconChange}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('server.chooseIcon')).toBeTruthy();
    for (const icon of SERVER_ICON_OPTIONS) expect(screen.getByLabelText(icon)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(SERVER_ICON_OPTIONS[1]));
    expect(onIconChange).toHaveBeenCalledWith(SERVER_ICON_OPTIONS[1]);
  });

  it('closes from the close button', async () => {
    const onClose = jest.fn();
    await render(
      <IconPicker
        visible
        currentIcon="server-outline"
        iconColor="#ff0000"
        onIconChange={jest.fn()}
        onClose={onClose}
      />,
    );
    await fireEvent.press(screen.getByLabelText('common.close'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ColorPicker', () => {
  function renderPicker(currentColor = '#007AFF') {
    const onColorChange = jest.fn();
    const onClose = jest.fn();
    const view = render(
      <ColorPicker
        visible
        currentColor={currentColor}
        onColorChange={onColorChange}
        onClose={onClose}
      />,
    );
    return { view, onColorChange, onClose };
  }

  it('shows the current color and applies a preset', async () => {
    const { view, onColorChange } = renderPicker('#007AFF');
    await view;
    expect(screen.getByText('#007AFF')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('#34C759'));
    expect(onColorChange).toHaveBeenCalledWith('#34C759');
    expect(screen.getByDisplayValue('#34C759')).toBeTruthy();
  });

  it('keeps the alpha of an rgba current color when a preset is chosen', async () => {
    const { view, onColorChange } = renderPicker('rgba(0, 0, 0, 0.5)');
    await view;
    await fireEvent.press(screen.getByLabelText('#FF3B30'));
    expect(onColorChange).toHaveBeenCalledWith('rgba(255, 59, 48, 0.5)');
  });

  it('applies a valid hex typed by hand, preserving alpha', async () => {
    const { view, onColorChange } = renderPicker('rgba(0, 0, 0, 0.25)');
    await view;
    await fireEvent.changeText(screen.getByPlaceholderText('#000000'), '#112233');
    expect(onColorChange).toHaveBeenCalledWith('rgba(17, 34, 51, 0.25)');
  });

  it('applies a plain hex typed by hand', async () => {
    const { view, onColorChange } = renderPicker('#000000');
    await view;
    await fireEvent.changeText(screen.getByPlaceholderText('#000000'), '#abc');
    expect(onColorChange).toHaveBeenCalledWith('#abc');
  });

  it('flags an invalid 7-character hex and does not apply it', async () => {
    const { view, onColorChange } = renderPicker('#000000');
    await view;
    await fireEvent.changeText(screen.getByPlaceholderText('#000000'), '#zzzzzz');
    expect(screen.getByText('Invalid hex color')).toBeTruthy();
    expect(onColorChange).not.toHaveBeenCalled();
  });

  it('save and close both dismiss and reset the input', async () => {
    const { view, onClose } = renderPicker('#007AFF');
    await view;
    await fireEvent.changeText(screen.getByPlaceholderText('#000000'), '#12');
    await fireEvent.press(screen.getByText('common.save'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue('#007AFF')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('common.close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('ServerAppearanceSection', () => {
  function renderSection(icon = '', iconColor = '') {
    const onIconChange = jest.fn();
    const onIconColorChange = jest.fn();
    const view = render(
      <ServerAppearanceSection
        icon={icon}
        iconColor={iconColor}
        onIconChange={onIconChange}
        onIconColorChange={onIconColorChange}
      />,
    );
    return { view, onIconChange, onIconColorChange };
  }

  it('picks a palette swatch', async () => {
    const { view, onIconColorChange } = renderSection();
    await view;
    await fireEvent.press(screen.getByLabelText(AVATAR_PALETTE[2]));
    expect(onIconColorChange).toHaveBeenCalledWith(AVATAR_PALETTE[2]);
  });

  it('opens the icon picker and closes it after a selection', async () => {
    const { view, onIconChange } = renderSection('home-outline', AVATAR_PALETTE[0]);
    await view;
    expect(screen.queryByText('server.chooseIcon')).toBeNull();
    await fireEvent.press(screen.getByText('server.icon'));
    expect(screen.getByText('server.chooseIcon')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('server-outline'));
    expect(onIconChange).toHaveBeenCalledWith('server-outline');
    expect(screen.queryByText('server.chooseIcon')).toBeNull();
  });

  it('closing the icon picker reports nothing', async () => {
    const { view, onIconChange } = renderSection();
    await view;
    await fireEvent.press(screen.getByText('server.icon'));
    await fireEvent.press(screen.getAllByLabelText('common.close')[0]);
    expect(screen.queryByText('server.chooseIcon')).toBeNull();
    expect(onIconChange).not.toHaveBeenCalled();
  });

  it('opens the full color picker from the custom swatch and forwards its changes', async () => {
    const { view, onIconColorChange } = renderSection('', '#123456');
    await view;
    await fireEvent.press(screen.getByLabelText('server.customColor'));
    expect(screen.getByText('screens.settings.pickAColor')).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText('#000000'), '#654321');
    expect(onIconColorChange).toHaveBeenCalledWith('#654321');
    await fireEvent.press(screen.getByText('common.save'));
    expect(screen.queryByText('screens.settings.pickAColor')).toBeNull();
  });
});
