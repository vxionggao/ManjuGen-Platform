The error `sqlalchemy.exc.OperationalError: table tasks has no column named created_at` indicates a database schema mismatch. The `Task` model was updated with new columns (`created_at`, `finished_at`), but the existing SQLite database (`app.db`) still has the old schema.

To resolve this, I will reset the database. This is safe for the development environment as the startup script automatically re-initializes the admin user and model configurations.

**Plan:**

1. **Stop Backend**: Terminate the current Python process in Terminal 6.
2. **Reset Database**: Delete the `app.db` file to remove the outdated schema.
3. **Restart Backend**: Relaunch the server. It will automatically recreate the database with the correct columns and default data.
4. **Verification**: Confirm the server starts successfully and the application works as expected.

