// Sync object
const config = {
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  testEnvironment: 'node',
  testRegex: '.*\\.test\\.ts$',
  moduleFileExtensions: [
    'js',
    'ts',
    'json'
  ],
  moduleNameMapper: {
    '(src/.*)$': '<rootDir>/$1'
  },
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  coverageDirectory: './coverage/',
  coveragePathIgnorePatterns: [
    '/dist/',
    '/node_modules/',
    '/src/tests/'
  ],
  collectCoverage: !!process.env.CI,
};

module.exports = config;
