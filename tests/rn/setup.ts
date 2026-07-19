jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return {
    ...actual,
    useRouter: jest.fn(() => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      dismiss: jest.fn(),
      dismissAll: jest.fn(),
      canGoBack: jest.fn(() => true),
      setParams: jest.fn(),
    })),
    useLocalSearchParams: jest.fn(() => ({})),
    useSegments: jest.fn(() => []),
    useFocusEffect: jest.fn(),
    useNavigation: jest.fn(() => ({ setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) })),
    Link: actual.Link,
  };
});
