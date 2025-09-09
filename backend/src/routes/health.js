const express = require('express');
const router = express.Router();

// Health check endpoint - pas besoin d'authentification
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'iComptaBudget'
  });
});

module.exports = router;