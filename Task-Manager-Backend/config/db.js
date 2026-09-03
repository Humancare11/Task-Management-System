const { Sequelize } = require("sequelize");
require("dotenv").config();

// Single source of truth for DB credentials (also used by sequelize-cli via
// .sequelizerc). NODE_ENV selects the block; "production" requires PROD_DB_*
// and will throw here at startup rather than silently using localhost.
const configs = require("./config");

const env =
  process.env.NODE_ENV === "production"
    ? "production"
    : process.env.NODE_ENV === "test"
    ? "test"
    : "development";

const cfg = configs[env]; // may throw for production with missing PROD_DB_*

const sequelize = new Sequelize(cfg.database, cfg.username, cfg.password, {
  host: cfg.host,
  port: cfg.port,
  dialect: cfg.dialect,
  logging: false, // set to console.log to see raw SQL
});

async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log(
      `✅ MySQL connected (${env} → ${cfg.username}@${cfg.host}:${cfg.port}/${cfg.database}).`
    );
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error.message);
    process.exit(1);
  }
}

module.exports = { sequelize, connectDB };
