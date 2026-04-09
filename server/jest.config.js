/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  // uuid v13 использует ESM — нужно трансформировать
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)',
  ],
  transform: {
    '^.+\\.js$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }],
  },
  // P1.9: coverage — начинаем с реалистичных порогов
  collectCoverageFrom: [
    'index.js',
    'db.js',
    'storage.js',
    'logger.js',
    'sentry.js',
  ],
  coverageThreshold: {
    global: {
      lines: 30,
      functions: 25,
      branches: 20,
    },
  },
};
