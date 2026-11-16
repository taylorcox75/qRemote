// helpers.tsx — shared stand-ins for the Settings screen suites.
// Not a test file itself (no .test suffix). Each suite wires these in with
// `jest.mock('<module>', () => require('./helpers').<name>)`, so every mock
// lives in the suite's own module registry and can be asserted on directly.
import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { mockColors } from '../../components/theme-mock';

export { mockColors };

/** i18n stand-in: returns the key, plus interpolation values when given. */
export const mockT = (key: string, opts?: Record<string, unknown>) => {
  if (!opts) return key;
  const values = Object.entries(opts)
    .filter(([k]) => k !== 'defaultValue')
    .map(([, v]) => String(v));
  return values.length ? `${key}:${values.join(',')}` : key;
};

export const i18nMock = {
  useTranslation: () => ({ t: mockT, i18n: { language: 'en', changeLanguage: jest.fn() } }),
};

export const routerMock = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismiss: jest.fn(),
  canGoBack: jest.fn(() => true),
  setParams: jest.fn(),
};

/** expo-router stand-in where useFocusEffect behaves like a mount effect. */
export const expoRouterMock = {
  useRouter: () => routerMock,
  useLocalSearchParams: jest.fn(() => ({})),
  useNavigation: () => ({ setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
  useFocusEffect: (cb: () => void | (() => void)) => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => cb(), [cb]);
  },
  Stack: Object.assign(({ children }: { children?: React.ReactNode }) => <>{children}</>, {
    Screen: () => null,
  }),
  Link: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
};

export const themeState = {
  isDark: true,
  themeMode: 'dark' as 'light' | 'dark' | 'auto',
  setThemeMode: jest.fn(),
  reloadCustomColors: jest.fn(async () => {}),
};

export const themeContextMock = {
  useTheme: () => ({ ...themeState, colors: mockColors }),
  darkColors: mockColors,
  lightColors: mockColors,
};

export const toastMock = { showToast: jest.fn() };
export const toastContextMock = { useToast: () => toastMock };

export const statusBarMock = { FocusAwareStatusBar: () => null };

interface PickerOption {
  label: string;
  value: string;
}

/** OptionPicker stand-in: each option is a button `option-<value>`. */
export const optionPickerMock = {
  OptionPicker: ({
    visible,
    title,
    options,
    selectedValue,
    onSelect,
    onClose,
  }: {
    visible: boolean;
    title: string;
    options: PickerOption[];
    selectedValue?: string;
    onSelect: (v: string) => void;
    onClose: () => void;
  }) =>
    visible ? (
      <View testID={`picker:${title}`}>
        <Text>{`picker-title:${title}`}</Text>
        {selectedValue !== undefined && <Text>{`picker-selected:${selectedValue}`}</Text>}
        {options.map((o) => (
          <TouchableOpacity key={o.value} testID={`option-${o.value}`} onPress={() => onSelect(o.value)}>
            <Text>{`option:${o.label}`}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity testID="picker-close" onPress={onClose}>
          <Text>picker-close</Text>
        </TouchableOpacity>
      </View>
    ) : null,
};

/** MultiSelectPicker stand-in: tapping `multi-<value>` toggles that value. */
export const multiSelectPickerMock = {
  MultiSelectPicker: ({
    visible,
    title,
    options,
    selectedValues,
    onChange,
    onClose,
  }: {
    visible: boolean;
    title: string;
    options: PickerOption[];
    selectedValues: string[];
    onChange: (v: string[]) => void;
    onClose: () => void;
  }) =>
    visible ? (
      <View testID={`multi:${title}`}>
        {options.map((o) => (
          <TouchableOpacity
            key={o.value}
            testID={`multi-${o.value}`}
            onPress={() =>
              onChange(
                selectedValues.includes(o.value)
                  ? selectedValues.filter((v) => v !== o.value)
                  : [...selectedValues, o.value],
              )
            }
          >
            <Text>{`multi:${o.label}`}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity testID="multi-close" onPress={onClose}>
          <Text>multi-close</Text>
        </TouchableOpacity>
      </View>
    ) : null,
};

/**
 * InputModal stand-in: a text field `input-modal-field` seeded from
 * defaultValue, `input-modal-confirm` (runs `validate` first, like the real
 * modal) and `input-modal-cancel`. Preset chips are `input-preset-<label>`.
 */
function MockInputModal({
  visible,
  title,
  defaultValue,
  onCancel,
  onConfirm,
  validate,
  presets,
}: {
  visible: boolean;
  title: string;
  defaultValue?: string;
  onCancel: () => void;
  onConfirm: (v: string) => void;
  validate?: (v: string) => string | null;
  presets?: { label: string; value: string }[];
}) {
  const [value, setValue] = useState(defaultValue ?? '');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setValue(defaultValue ?? '');
      setError(null);
    }
  }, [visible, defaultValue]);
  if (!visible) return null;
  return (
    <View testID={`input-modal:${title}`}>
      <Text>{`input-title:${title}`}</Text>
      <TextInput testID="input-modal-field" value={value} onChangeText={setValue} />
      {presets?.map((p) => (
        <TouchableOpacity key={p.label} testID={`input-preset-${p.label}`} onPress={() => setValue(p.value)}>
          <Text>{p.label}</Text>
        </TouchableOpacity>
      ))}
      {error && <Text>{`input-error:${error}`}</Text>}
      <TouchableOpacity
        testID="input-modal-confirm"
        onPress={() => {
          const err = validate ? validate(value) : null;
          if (err) {
            setError(err);
            return;
          }
          onConfirm(value);
        }}
      >
        <Text>input-confirm</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="input-modal-cancel" onPress={onCancel}>
        <Text>input-cancel</Text>
      </TouchableOpacity>
    </View>
  );
}
export const inputModalMock = { InputModal: MockInputModal };

/** ConfirmModal stand-in: each button is `confirm-<label>`, plus `confirm-cancel`. */
export const confirmModalMock = {
  ConfirmModal: ({
    visible,
    title,
    message,
    buttons,
    onCancel,
  }: {
    visible: boolean;
    title: string;
    message?: string;
    buttons: { label: string; onPress: () => void }[];
    onCancel: () => void;
  }) =>
    visible ? (
      <View testID={`confirm:${title}`}>
        <Text>{`confirm-title:${title}`}</Text>
        {message ? <Text>{`confirm-message:${message}`}</Text> : null}
        {buttons.map((b) => (
          <TouchableOpacity key={b.label} testID={`confirm-${b.label}`} onPress={b.onPress}>
            <Text>{b.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity testID="confirm-cancel" onPress={onCancel}>
          <Text>confirm-cancel</Text>
        </TouchableOpacity>
      </View>
    ) : null,
};

/** ColorPicker stand-in: `color-pick` reports #ABCDEF, `color-close` closes. */
export const colorPickerMock = {
  ColorPicker: ({
    visible,
    currentColor,
    onColorChange,
    onClose,
  }: {
    visible: boolean;
    currentColor: string;
    onColorChange: (c: string) => void;
    onClose: () => void;
  }) =>
    visible ? (
      <View testID="color-picker">
        <Text>{`color-current:${currentColor}`}</Text>
        <TouchableOpacity testID="color-pick" onPress={() => onColorChange('#ABCDEF')}>
          <Text>color-pick</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="color-close" onPress={onClose}>
          <Text>color-close</Text>
        </TouchableOpacity>
      </View>
    ) : null,
};

/** PathAutocompleteInput stand-in: a plain TextInput (no directory lookups). */
export const pathAutocompleteMock = {
  PathAutocompleteInput: (props: React.ComponentProps<typeof TextInput>) => <TextInput {...props} />,
  isWindowsStylePath: (p: string) => /^[A-Za-z]:[\\/]/.test(p) || p.includes('\\'),
};

/** Resets every shared jest.fn above; call from each suite's beforeEach. */
export function resetSharedMocks() {
  Object.values(routerMock).forEach((fn) => fn.mockClear());
  routerMock.canGoBack.mockReturnValue(true);
  toastMock.showToast.mockClear();
  themeState.isDark = true;
  themeState.themeMode = 'dark';
  themeState.setThemeMode.mockClear();
  themeState.reloadCustomColors.mockClear();
  expoRouterMock.useLocalSearchParams.mockReturnValue({});
}

/** Flush pending promise callbacks (several rounds for chained awaits). */
export async function flush(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
}
