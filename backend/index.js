const express = require('express');
const config = require('./src/config');
const corsMiddleware = require('./src/middleware/cors');
const { ensureDataDbExists, migrateDataDb } = require('./src/services/projectService');

// Import route modules
const authRoutes = require('./src/routes/auth');
const authMiddleware = require('./src/middleware/auth');
const projectsRoutes = require('./src/routes/projects');
const settingsRoutes = require('./src/routes/settings');
const accountsRoutes = require('./src/routes/accounts');
const transactionsRoutes = require('./src/routes/transactions');
const accountPreferencesRoutes = require('./src/routes/accountPreferences');
const monthlySavingsRoutes = require('./src/routes/monthlySavings');
const monthlyManualSavingsRoutes = require('./src/routes/monthlyManualSavings');
const projectAllocationsRoutes = require('./src/routes/projectAllocations');
const savingsAmountsRoutes = require('./src/routes/savingsAmounts');
const autoMapRoutes = require('./src/routes/autoMap');
const splitProjectsRoutes = require('./src/routes/splitProjects');
const savingGoalsRoutes = require('./src/routes/savingGoals');
const categoryMatrixRoutes = require('./src/routes/categoryMatrix');

const app = express();

// Load version
const pkg = require('./package.json');
const version = pkg.version;

// Configure middleware
app.use(corsMiddleware);
app.use(express.json());

// Configure routes
app.use('/api/auth', authRoutes);

// Appliquer l'authentification à toutes les autres routes API
app.use('/api', authMiddleware);

app.use('/api/projects', projectsRoutes);
app.use('/api', settingsRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/account-preferences', accountPreferencesRoutes);
app.use('/api/monthly-savings', monthlySavingsRoutes);
app.use('/api/monthly-manual-savings', monthlyManualSavingsRoutes);
app.use('/api/project-allocations', projectAllocationsRoutes);
app.use('/api/savings-amounts', savingsAmountsRoutes);
app.use('/api/auto-map', autoMapRoutes);
app.use('/api/split-projects', splitProjectsRoutes);
app.use('/api/saving-goals', savingGoalsRoutes);
app.use('/api/category-matrix', categoryMatrixRoutes);
app.use('/api/assistant', require('./src/routes/assistant'));

// Endpoint de healthcheck simple (utilisé par Docker HEALTHCHECK)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
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
    console.log(`Starting express server (v${version})...`);
    app.listen(port, () => {
      console.log(`Backend v${version} listening on http://${config.HOST}:${port}/api/`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
