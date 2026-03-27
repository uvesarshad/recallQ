const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    const migrationFiles = fs
      .readdirSync(path.join(__dirname, '../migrations'))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const migrationFile of migrationFiles) {
      console.log(`Running migration: ${migrationFile}`);
      const sqlFile = path.join(__dirname, '../migrations', migrationFile);
      const sql = fs.readFileSync(sqlFile, 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '42701' || err.code === '42P07') {
          console.log(`Skipping already-applied migration: ${migrationFile}`);
          continue;
        }
        throw err;
      }
    }

    console.log('All migrations completed.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
