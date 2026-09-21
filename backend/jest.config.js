/*
 * Configuración de Jest para el módulo base (Usuarios/Roles).
 * Exige cobertura >= 80% en statements, branches, functions y lines
 * sobre los archivos del módulo de autenticación.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'src/controllers/auth.controller.js',
    'src/routes/auth.routes.js',
    'src/utils/jwt.js',
    'src/middleware/verifyToken.js',
    'src/middleware/isAdmin.js',
    'src/middleware/errorHandler.js'
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    }
  },
  verbose: true
};