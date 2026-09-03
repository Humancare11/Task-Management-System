"use strict";

// Production entrypoint (`npm start`). Forces NODE_ENV=production so config/db.js
// resolves the production (PROD_DB_*) database, cross-platform, without needing a
// shell that understands `NODE_ENV=production node ...`. Local development uses
// `npm run dev` instead.
process.env.NODE_ENV = process.env.NODE_ENV || "production";
require("../index.js");
