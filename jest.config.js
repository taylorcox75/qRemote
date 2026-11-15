// Coverage counts a file no test imports only if it is in some project's
// `roots`, so each project lists the source directories it owns next to its
// tests: pure TypeScript (utils/services/constants) in `node`, React code
// (app/components/context/hooks) in `rn`, whose Babel transform handles JSX.
// Without this, untested files were silently left out of the total.
// `testMatch` keeps test discovery limited to the tests directories, so the
// suites that run are exactly as before.
const TEST_MATCH = (dir) => [`<rootDir>/${dir}/**/?(*.)+(spec|test).[jt]s?(x)`];

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
      roots: ['<rootDir>/tests', '<rootDir>/utils', '<rootDir>/services', '<rootDir>/constants'],
      testMatch: TEST_MATCH('tests'),
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
      roots: [
        '<rootDir>/tests/rn',
        '<rootDir>/app',
        '<rootDir>/components',
        '<rootDir>/context',
        '<rootDir>/hooks',
      ],
      testMatch: TEST_MATCH('tests/rn'),
      setupFiles: ['react-native-gesture-handler/jestSetup'],
      setupFilesAfterEnv: ['<rootDir>/tests/rn/setup.ts'],
      testPathIgnorePatterns: ['<rootDir>/tests/rn/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
    },
  ],
};
