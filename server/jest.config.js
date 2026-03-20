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
};
