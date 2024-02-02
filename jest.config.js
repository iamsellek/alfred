module.exports = {
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  collectCoverage: true,
  coverageReporters: ['cobertura', 'html'],
  testPathIgnorePatterns: ['/node_modules'],
  moduleDirectories: ['node_modules', '<rootDir>'],
  preset: 'ts-jest',
};
