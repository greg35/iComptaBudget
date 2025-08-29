const config = require('../config');

const corsMiddleware = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', config.CORS.ORIGIN);
  res.header('Access-Control-Allow-Methods', config.CORS.METHODS);
  res.header('Access-Control-Allow-Headers', config.CORS.HEADERS);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
};

module.exports = corsMiddleware;
