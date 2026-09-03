"use strict";

/**
 * Database configuration — the SINGLE source of truth for both the app runtime
 * (config/db.js) and sequelize-cli migrations (.sequelizerc points here).
 *
 * Phase 5 fix: the three environments no longer collapse onto one set of
 * localhost-pointed vars.
 *
 *   development / test  ->  DB_* env vars, localhost-friendly defaults.
 *   production          ->  PROD_DB_* env vars, REQUIRED (host, name, user).
 *                           Requesting the production config with any of those
 *                           missing throws immediately — a real deploy fails
 *                           loudly instead of silently talking to localhost.
 *
 * On a real deploy set NODE_ENV=production and the PROD_DB_* vars in the hosting
 * environment (not in a committed .env).
 */

require("dotenv").config();

const SHARED = { dialect: "mysql", logging: false };

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const development = {
  ...SHARED,
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "task_manager",
  host: process.env.DB_HOST || "127.0.0.1",
  port: num(process.env.DB_PORT, 3306),
};

const test = {
  ...development,
  database: process.env.TEST_DB_NAME || process.env.DB_NAME || "task_manager",
};

function buildProduction() {
  const missing = [];
  const host = process.env.PROD_DB_HOST;
  const database = process.env.PROD_DB_NAME;
  const username = process.env.PROD_DB_USER;
  if (!host) missing.push("PROD_DB_HOST");
  if (!database) missing.push("PROD_DB_NAME");
  if (!username) missing.push("PROD_DB_USER");
  if (missing.length) {
    throw new Error(
      `[db config] production requires ${missing.join(", ")}. ` +
        "Set the PROD_DB_* vars in the deploy environment. " +
        "Refusing to fall back to the development / localhost database."
    );
  }
  if (/^(localhost|127\.0\.0\.1|::1)$/i.test(host.trim())) {
    console.warn(
      `[db config] WARNING: PROD_DB_HOST is "${host}" — the production ` +
        "database is pointed at localhost. This is almost certainly wrong."
    );
  }
  return {
    ...SHARED,
    username,
    password: process.env.PROD_DB_PASSWORD || "",
    database,
    host,
    port: num(process.env.PROD_DB_PORT, 3306),
  };
}

// Lazy: accessing `.production` (sequelize-cli --env production, or config/db.js
// when NODE_ENV=production) is what triggers the required-vars check. `require`
// of this file, and reading development/test, never do.
module.exports = {
  development,
  test,
  get production() {
    return buildProduction();
  },
};
