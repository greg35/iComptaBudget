const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('./src/config');

(async () => {
    try {
        const SQL = await initSqlJs();
        const dataBuffer = fs.readFileSync(config.DB_PATH);
        const db = new SQL.Database(dataBuffer);

        console.log("Counting future transactions...");
        const today = new Date().toISOString().split('T')[0];
        const countRes = db.exec(`
      SELECT COUNT(*) 
      FROM ICTransaction t
      WHERE t.date > '${today}'
    `);

        if (countRes.length > 0) {
            console.log("Future transactions count:", countRes[0].values[0][0]);
        }
    } catch (e) {
        console.error(e);
    }
})();
