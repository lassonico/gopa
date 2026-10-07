const MySQLRepository = require('./MySQLRepository');
const JsonFileRepository = require('./JsonFileRepository');

const engine = process.env.DB_ENGINE || 'mysql';
let repository;

if (engine === 'json') {
  repository = new JsonFileRepository();
  console.log('[DB] Repositorio: JsonFileRepository (datos locales en data/)');
} else {
  repository = new MySQLRepository();
  console.log('[DB] Repositorio: MySQLRepository');
}

module.exports = repository;