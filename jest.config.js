const sdkProject = {
  displayName: 'sdk',
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: [
    '**/test/auto/sdk/**/*.ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }]
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 10000
};

const uiProject = {
  displayName: 'ui',
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: [
    '**/test/auto/app/**/*.tsx'
  ],
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { useESM: true, tsconfig: { jsx: 'react-jsx', isolatedModules: true } }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup/jest.setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.d.ts'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testTimeout: 10000
};

const config = {
  projects: [sdkProject, uiProject]
};

export default config;
