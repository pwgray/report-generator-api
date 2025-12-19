# Server Environment Variables Setup

Create a `.env` file in the `server/` directory with the following variables:

## Required Variables

```env
# Server Configuration
PORT=4000

# Google Gemini API Key (required for AI features)
GEMINI_API_KEY=your_gemini_api_key_here
```

## Optional Variables

### AI Configuration
```env
# AI Request Timeout (milliseconds)
AI_TIMEOUT_MS=5000
```

### Database Configuration

**SQLite (Default - Best for Development)**
```env
DB_TYPE=sqlite
SQLITE_DB=./server/db.sqlite
# Or use in-memory for testing:
# SQLITE_DB=:memory:
```

**PostgreSQL**
```env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=report_generator
DB_SSL=false
```

**MySQL/MariaDB**
```env
DB_TYPE=mysql
# Or: DB_TYPE=mariadb
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=report_generator
```

**Microsoft SQL Server**
```env
DB_TYPE=mssql
DB_HOST=localhost
DB_PORT=1433
DB_USERNAME=sa
DB_PASSWORD=your_password
DB_DATABASE=report_generator
DB_ENCRYPT=false
DB_TRUST_SERVER_CERT=true
```

### TypeORM Configuration
```env
# Auto-create/update database tables (disable in production!)
DB_SYNCHRONIZE=true

# Enable SQL query logging for debugging
DB_LOGGING=false
```

## Example .env File

For local development:

```env
PORT=4000
GEMINI_API_KEY=your_actual_api_key_here
DB_TYPE=sqlite
SQLITE_DB=./server/db.sqlite
DB_SYNCHRONIZE=true
DB_LOGGING=false
```

## Security Notes

- **Never commit the `.env` file to version control**
- Keep your `GEMINI_API_KEY` secret
- Use different credentials for development and production
- Set `DB_SYNCHRONIZE=false` in production environments

