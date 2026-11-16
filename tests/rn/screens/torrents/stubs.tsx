// Lightweight stand-ins for the modal / picker components the torrents
// screens mount. Not a test file. Each stub renders nothing while hidden and,
// when visible, exposes its callbacks as plain pressables with stable testIDs,
// so a screen test can drive the screen's handlers (what it sends to the API,
// what it shows afterwards) without depending on the real modal's markup —
// those components have their own suites under tests/rn/components.
import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

interface InputModalStubProps {
  visible: boolean;
  title: string;
  defaultValue?: string;
  validate?: (value: string) => string | null;
  computeHint?: (value: string) => string | null;
  presets?: { label: string; value: string }[];
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

export function InputModal(props: InputModalStubProps) {
  if (!props.visible) return null;
  // Keyed so each opening starts from the screen's defaultValue.
  return <InputModalBody key={props.defaultValue ?? ''} {...props} />;
}

function InputModalBody(props: InputModalStubProps) {
  const [value, setValue] = useState(props.defaultValue ?? '');
  const error = props.validate?.(value) ?? null;
  const hint = props.computeHint?.(value) ?? null;
  return (
    <View testID="input-modal">
      <Text testID="input-modal-title">{props.title}</Text>
      <TextInput testID="input-modal-field" value={value} onChangeText={setValue} />
      {error ? <Text testID="input-modal-error">{error}</Text> : null}
      {hint ? <Text testID="input-modal-hint">{hint}</Text> : null}
      {(props.presets ?? []).map((p) => (
        <TouchableOpacity
          key={p.value}
          testID={`input-preset-${p.value}`}
          onPress={() => setValue(p.value)}
        />
      ))}
      <TouchableOpacity testID="input-modal-confirm" onPress={() => props.onConfirm(value)} />
      <TouchableOpacity testID="input-modal-cancel" onPress={props.onCancel} />
    </View>
  );
}

interface ConfirmModalStubProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: { label: string; onPress: () => void }[];
  onCancel: () => void;
}

export function ConfirmModal(props: ConfirmModalStubProps) {
  if (!props.visible) return null;
  return (
    <View testID="confirm-modal">
      <Text>{props.title}</Text>
      {props.message ? <Text testID="confirm-modal-message">{props.message}</Text> : null}
      {props.buttons.map((b) => (
        <TouchableOpacity key={b.label} testID={`confirm-${b.label}`} onPress={b.onPress} />
      ))}
      <TouchableOpacity testID="confirm-cancel" onPress={props.onCancel} />
    </View>
  );
}

interface OptionPickerStubProps {
  visible: boolean;
  title: string;
  options: { label: string; value: string }[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function OptionPicker(props: OptionPickerStubProps) {
  if (!props.visible) return null;
  return (
    <View testID={`picker-${props.title}`}>
      {props.options.map((o) => (
        <TouchableOpacity
          key={o.value}
          testID={`option-${o.value}`}
          onPress={() => props.onSelect(o.value)}
        >
          <Text>{o.label}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity testID="picker-close" onPress={props.onClose} />
    </View>
  );
}

interface MultiSelectStubProps {
  visible: boolean;
  title: string;
  options: { label: string; value: string }[];
  selectedValues: string[];
  onChange?: (values: string[]) => void;
  onClose: () => void;
}

export function MultiSelectPicker(props: MultiSelectStubProps) {
  if (!props.visible) return null;
  return (
    <View testID={`multi-${props.title}`}>
      {props.options.map((o) => (
        <TouchableOpacity
          key={o.value}
          testID={`multi-option-${o.value}`}
          onPress={() =>
            props.onChange?.(
              props.selectedValues.includes(o.value)
                ? props.selectedValues.filter((v) => v !== o.value)
                : [...props.selectedValues, o.value],
            )
          }
        >
          <Text>{o.label}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity testID="multi-close" onPress={props.onClose} />
    </View>
  );
}

interface CategoryModalStubProps {
  visible: boolean;
  allCategories: string[];
  onSelect: (category: string) => Promise<void>;
  onCreateAndSelect: (category: string) => Promise<void>;
  onDeleteCategory?: (category: string) => Promise<void>;
  onClose: () => void;
}

export function CategoryModal(props: CategoryModalStubProps) {
  if (!props.visible) return null;
  return (
    <View testID="category-modal">
      {props.allCategories.map((c) => (
        <Text key={c}>{`category:${c}`}</Text>
      ))}
      <TouchableOpacity testID="category-select" onPress={() => props.onSelect('movies')} />
      <TouchableOpacity testID="category-select-none" onPress={() => props.onSelect('')} />
      <TouchableOpacity testID="category-create" onPress={() => props.onCreateAndSelect('fresh')} />
      <TouchableOpacity
        testID="category-delete"
        onPress={() => props.onDeleteCategory?.('movies')}
      />
      <TouchableOpacity testID="category-close" onPress={props.onClose} />
    </View>
  );
}

interface TagsModalStubProps {
  visible: boolean;
  onAddTag: (tag: string) => Promise<void>;
  onRemoveTag: (tag: string) => Promise<void>;
  onCreateTag?: (tag: string) => Promise<void>;
  onDeleteTag?: (tag: string) => Promise<void>;
  onClose: () => void;
}

export function TagsModal(props: TagsModalStubProps) {
  if (!props.visible) return null;
  return (
    <View testID="tags-modal">
      <TouchableOpacity testID="tags-add" onPress={() => props.onAddTag('hd')} />
      <TouchableOpacity testID="tags-remove" onPress={() => props.onRemoveTag('hd')} />
      <TouchableOpacity testID="tags-create" onPress={() => props.onCreateTag?.('new')} />
      <TouchableOpacity testID="tags-delete" onPress={() => props.onDeleteTag?.('old')} />
      <TouchableOpacity testID="tags-close" onPress={props.onClose} />
    </View>
  );
}
