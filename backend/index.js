const express = require('express');
const config = require('./src/config');
const corsMiddleware = require('./src/middleware/cors');
const { ensureDataDbExists, migrateDataDb } = require('./src/services/projectService');

// Import route modules
const projectsRoutes = require('./src/routes/projects');
const settingsRoutes = require('./src/routes/settings');
const accountsRoutes = require('./src/routes/accounts');
const transactionsRoutes = require('./src/routes/transactions');
const accountPreferencesRoutes = require('./src/routes/accountPreferences');
const monthlySavingsRoutes = require('./src/routes/monthlySavings');
const autoMapRoutes = require('./src/routes/autoMap');
const splitProjectsRoutes = require('./src/routes/splitProjects');

const app = express();

// Configure middleware
app.use(corsMiddleware);
app.use(express.json());

// Configure routes
app.use('/api/projects', projectsRoutes);
app.use('/api', settingsRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/account-preferences', accountPreferencesRoutes);
app.use('/api/monthly-savings', monthlySavingsRoutes);
app.use('/api/auto-map', autoMapRoutes);
app.use('/api/split-projects', splitProjectsRoutes);

// Legacy endpoint for project transactions (for frontend compatibility)
app.use('/api/project-transactions', (req, res, next) => {
  // Redirect to the correct endpoint in the transactions router
  req.url = '/project-transactions' + (req.url === '/' ? '' : req.url);
  transactionsRoutes(req, res, next);
});

// Start server
const port = config.PORT;
console.log('Starting server with port:', port);
(async () => {
  try {
    console.log('Ensuring data DB exists...');
    await ensureDataDbExists();
    console.log('Migrating data DB...');
    await migrateDataDb();
    console.log('Starting express server...');
    app.listen(port, () => {
      console.log(`Backend listening on http://${config.HOST}:${port}/api/projects`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
