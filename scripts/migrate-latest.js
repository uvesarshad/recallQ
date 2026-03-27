const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const migrationFiles = fs
    .readdirSync(path.join(__dirname, '../migrations'))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const migrationFile = migrationFiles[migrationFiles.length - 1];
  if (!migrationFile) {
    console.log('No migration files found.');
    return;
  }

  console.log(`Running migration: ${migrationFile}`);
  const sqlFile = path.join(__dirname, '../migrations/', migrationFile);
  const sql = fs.readFileSync(sqlFile, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration successful.');
  } catch (err) {
    // Ignore if column already exists
    if (err.code === '42701') {
      console.log('Column already exists, skipping.');
      await client.query('ROLLBACK');
    } else {
      await client.query('ROLLBACK');
      console.error('Migration failed:', err);
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
