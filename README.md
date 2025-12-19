# report-generator - Server

This directory contains the API server for the DataFlow reporter app. It is meant to be extracted into its own repository and run independently.

Quickstart (standalone):

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create a `.env` file with required configuration (see `ENV_SETUP.md` for details):

   ```text
   GEMINI_API_KEY=your_server_gemini_api_key_here
   PORT=4000
   DB_TYPE=sqlite
   SQLITE_DB=./server/db.sqlite
   ```

   For detailed configuration options including PostgreSQL, MySQL, and MS SQL Server, see [ENV_SETUP.md](./ENV_SETUP.md).

3. Run in development:

   ```powershell
   npm run dev
   ```

4. API endpoints:
   - GET /api/health
   - CRUD /api/datasources
   - CRUD /api/reports
   - POST /api/ai/generate
   - POST /api/ai/discover
- POST /api/datasources/test-connection — accepts { type: 'postgres'|'sql', connectionDetails: { host, port, database, username, password } } and returns a JSON array of tables/columns when successful (Postgres and Microsoft SQL Server supported)
- POST /api/datasources/query — accepts { dataSourceId, table, columns: string[], limit?: number } and returns an array of rows from the selected table (read-only, limited by `limit`).

Notes:
- This server uses SQLite by default for local dev (file: `server/db.sqlite`).
- For production, configure PostgreSQL, MySQL, or MS SQL Server via environment variables (see `ENV_SETUP.md`).
- Database configuration is fully managed via `.env` file - no code changes needed to switch databases.
- Keep `GEMINI_API_KEY` server-side; do not expose it to frontend builds.
- Set `DB_SYNCHRONIZE=false` in production to prevent automatic schema changes.
