module.exports = {
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'context/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    'constants/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
  projects: [
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests'],
      testPathIgnorePatterns: ['<rootDir>/tests/rn/'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
    },
    {
      displayName: 'rn',
      preset: 'jest-expo',
      // Reanimated 4 / Worklets (pulled in by ReanimatedSwipeable) need a JSI
      // runtime Jest lacks; this resolver swaps in their web implementations.
      resolver: 'react-native-reanimated/jest/resolver',
      roots: ['<rootDir>/tests/rn'],
      setupFiles: ['react-native-gesture-handler/jestSetup'],
      setupFilesAfterEnv: ['<rootDir>/tests/rn/setup.ts'],
      testPathIgnorePatterns: ['<rootDir>/tests/rn/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
    },
  ],
};
