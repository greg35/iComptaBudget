const path = require('path');

const config = {
  // Database paths (remonte de deux niveaux depuis src/config)
  DB_PATH: path.join(__dirname, '..', '..', '..', 'Comptes.cdb'),
  DATA_DB_PATH: path.join(__dirname, '..', '..', '..', 'iComptaBudgetData.sqlite'),
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
