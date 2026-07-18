import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { InputModal } from '@/components/InputModal';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      text: '#000',
      textSecondary: '#666',
      background: '#eee',
      surfaceOutline: '#ccc',
      primary: '#00f',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('InputModal', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders title and message', async () => {
    await render(
      <InputModal
        visible
        title="Rename"
        message="Enter a new name"
        placeholder="type here"
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    );
    expect(screen.getByText('Rename')).toBeTruthy();
    expect(screen.getByText('Enter a new name')).toBeTruthy();
  });

  it('does not render message when omitted', async () => {
    await render(
      <InputModal visible title="Rename" placeholder="p" onCancel={jest.fn()} onConfirm={jest.fn()} />
    );
    expect(screen.queryByText('Enter a new name')).toBeNull();
  });

  it('initializes input with defaultValue', async () => {
    await render(
      <InputModal
        visible
        title="Rename"
        defaultValue="old-name"
        placeholder="p"
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    );
    expect(screen.getByDisplayValue('old-name')).toBeTruthy();
  });

  it('updates defaultValue when it changes while visible', async () => {
    const { rerender } = await render(
      <InputModal visible title="Rename" defaultValue="a" placeholder="p" onCancel={jest.fn()} onConfirm={jest.fn()} />
    );
    expect(screen.getByDisplayValue('a')).toBeTruthy();
    await rerender(
      <InputModal visible title="Rename" defaultValue="b" placeholder="p" onCancel={jest.fn()} onConfirm={jest.fn()} />
    );
    expect(screen.getByDisplayValue('b')).toBeTruthy();
  });

  it('lets the user type into the input', async () => {
    await render(
      <InputModal visible title="Rename" placeholder="type here" onCancel={jest.fn()} onConfirm={jest.fn()} />
    );
    await fireEvent.changeText(screen.getByPlaceholderText('type here'), 'hello');
    expect(screen.getByPlaceholderText('type here').props.value).toBe('hello');
  });

  it('calls onConfirm with trimmed value on confirm press', async () => {
    const onConfirm = jest.fn();
    await render(
      <InputModal visible title="Rename" placeholder="type here" onCancel={jest.fn()} onConfirm={onConfirm} />
    );
    await fireEvent.changeText(screen.getByPlaceholderText('type here'), '  hello  ');
    await fireEvent.press(screen.getByText('common.confirm'));
    expect(onConfirm).toHaveBeenCalledWith('hello');
  });

  it('does not confirm empty input unless allowEmpty', async () => {
    const onConfirm = jest.fn();
    await render(
      <InputModal visible title="Rename" placeholder="p" onCancel={jest.fn()} onConfirm={onConfirm} />
    );
    await fireEvent.press(screen.getByText('common.confirm'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms empty input when allowEmpty is true', async () => {
    const onConfirm = jest.fn();
    await render(
      <InputModal visible title="Rename" placeholder="p" onCancel={jest.fn()} onConfirm={onConfirm} allowEmpty />
    );
    await fireEvent.press(screen.getByText('common.confirm'));
    expect(onConfirm).toHaveBeenCalledWith('');
  });

  it('calls onCancel on cancel press', async () => {
    const onCancel = jest.fn();
    await render(
      <InputModal visible title="Rename" defaultValue="x" placeholder="p" onCancel={onCancel} onConfirm={jest.fn()} />
    );
    await fireEvent.press(screen.getByText('common.cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('passes multiline prop to TextInput', async () => {
    await render(
      <InputModal visible title="Rename" placeholder="p" onCancel={jest.fn()} onConfirm={jest.fn()} multiline />
    );
    const textInput = screen.getByPlaceholderText('p');
    expect(textInput.props.multiline).toBe(true);
  });

  it('passes keyboardType prop to TextInput', async () => {
    await render(
      <InputModal
        visible
        title="Rename"
        placeholder="p"
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        keyboardType="numeric"
      />
    );
    const textInput = screen.getByPlaceholderText('p');
    expect(textInput.props.keyboardType).toBe('numeric');
  });
});
