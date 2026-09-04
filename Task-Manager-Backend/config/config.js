"use strict";

/**
 * Database configuration — single source of truth for the app runtime
 * (config/db.js) and sequelize-cli migrations (.sequelizerc points here).
 *
 * All environments read DB_* by default. Production ADDITIONALLY honours
 * optional PROD_DB_* overrides so a real deploy can use credentials that are
 * distinct from local development without touching DB_*. If PROD_DB_* is not
 * set, production falls back to DB_* — the long-standing behaviour — so this
 * never breaks an existing deploy.
 *
 * Recommended for a real deploy: set PROD_DB_HOST / PROD_DB_PORT / PROD_DB_NAME
 * / PROD_DB_USER / PROD_DB_PASSWORD in the hosting environment.
 */

require("dotenv").config();

const SHARED = { dialect: "mysql", logging: false };

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const development = {
  ...SHARED,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST || "127.0.0.1",
  port: num(process.env.DB_PORT, 3306),
};

const test = {
  ...development,
  database: process.env.TEST_DB_NAME || process.env.DB_NAME,
};

// Prefer PROD_DB_*, fall back to DB_*.
const pick = (prodKey, devKey) =>
  process.env[prodKey] !== undefined && process.env[prodKey] !== ""
    ? process.env[prodKey]
    : process.env[devKey];

const production = {
  ...SHARED,
  username: pick("PROD_DB_USER", "DB_USER"),
  password: pick("PROD_DB_PASSWORD", "DB_PASSWORD"),
  database: pick("PROD_DB_NAME", "DB_NAME"),
  host: pick("PROD_DB_HOST", "DB_HOST") || "127.0.0.1",
  port: num(process.env.PROD_DB_PORT || process.env.DB_PORT, 3306),
};

if (process.env.NODE_ENV === "production" && !process.env.PROD_DB_HOST) {
  // Not fatal — many hosts co-locate MySQL and DB_HOST=localhost is correct
  // there — but flag it so a misconfigured deploy is visible in the logs.
  console.warn(
    "[db config] NODE_ENV=production but PROD_DB_HOST is not set — falling back " +
      `to DB_* (host: ${production.host}). Set PROD_DB_* to make prod credentials explicit.`
  );
}

module.exports = { development, test, production };
