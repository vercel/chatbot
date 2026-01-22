module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
  coverageReporters: ['text', 'html'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  reporters: ['default', 'github-actions'],
};
