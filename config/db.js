// This file sets up the connection to our PostgreSQL database.
// Every other file that needs to read or save data will use this connection.

const { Pool } = require('pg');
require('dotenv').config();

// Cloud-hosted databases (like Render) require a secure connection.
// Set DB_SSL=true in the environment when connecting to one of those;
// leave it unset for a normal local database, which doesn't need it.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
