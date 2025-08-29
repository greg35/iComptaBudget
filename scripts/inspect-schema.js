const initSqlJs = require('sql.js');
const fs = require('fs');
(async function(){
  try{
    const SQL = await initSqlJs();
    const buf = fs.readFileSync('Comptes.cdb');
    const db = new SQL.Database(buf);
    const res = db.exec("PRAGMA table_info('ICTransaction')");
    console.log(JSON.stringify(res, null, 2));
    db.close();
  }catch(e){console.error(e);process.exit(1)}
})();
