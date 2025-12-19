# report-generator - Server

This directory contains the API server for the DataFlow reporter app. It is meant to be extracted into its own repository and run independently.

Quickstart (standalone):

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env` and set your server-side Gemini key (do NOT commit `.env`):

   ```text
   GEMINI_API_KEY=your_server_gemini_api_key_here
   PORT=4000
   ```

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
- This server uses SQLite for local dev (file: `server/db.sqlite`). For production, switch to a managed DB and update `data-source.ts` accordingly.
- Keep `GEMINI_API_KEY` server-side; do not expose it to frontend builds.
