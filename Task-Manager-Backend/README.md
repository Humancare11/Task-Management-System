# Task Manager — Backend Skeleton

This is intentionally minimal: just enough to prove Express + MySQL are talking to each other.

## Setup (do this in order)

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create your MySQL database**
   Open MySQL and run:
   ```sql
   CREATE DATABASE task_manager;
   ```

3. **Copy the env file and fill in your real values**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` — set `DB_PASSWORD` to your actual MySQL root password.

4. **Run the schema** (the schema.sql file from earlier) against your `task_manager` database
   to create all the tables:
   ```bash
   mysql -u root -p task_manager < schema.sql
   ```

5. **Start the server**
   ```bash
   npm run dev
   ```

6. **Confirm it works**
   Open a browser (or use curl/Postman) and hit:
   ```
   http://localhost:5000/api/health
   ```
   You should see: `{"status":"ok","message":"Server is running"}`
   And in your terminal: `✅ MySQL connected successfully.`

## If you see this, you're done with step 1

That's the whole goal right now — nothing else. Once this works, come back and we'll
add the User model + signup/login routes next.

## Folder structure (already created, currently empty — will fill these in next)

- `config/` — DB connection (already done)
- `models/` — Sequelize models (one file per table: User.js, Project.js, Task.js...)
- `routes/` — Express route definitions (e.g. authRoutes.js, projectRoutes.js)
- `controllers/` — the actual logic behind each route
- `middleware/` — auth middleware (JWT verification), error handlers
