const path = require('path');

const DATA_DIR = process.env.DATA_DIR || './data';

const config = {
  // Database paths - stockées dans /data pour Docker
  DB_PATH: process.env.DB_PATH || path.join(DATA_DIR, 'Comptes.cdb'),
  DATA_DB_PATH: process.env.DATA_DB_PATH || path.join(DATA_DIR, 'iComptaBudgetData.sqlite'),
  PROJECTS_FILE: path.join(__dirname, '..', '..', 'projects.json'),

  // Server configuration
  PORT: process.env.PORT || 2113,
  HOST: '127.0.0.1',

  // CORS configuration
  CORS: {
    ORIGIN: '*',
    METHODS: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    HEADERS: 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  }
};

module.exports = config;