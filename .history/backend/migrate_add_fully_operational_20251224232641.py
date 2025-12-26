#!/usr/bin/env python3
"""
Migration script to add 'fully_operational' status to the database schema.

This updates the CHECK constraint on the system_states table to include the new status.

Usage:
    python migrate_add_fully_operational.py
"""

import asyncio
import aiosqlite
from pathlib import Path


async def migrate_add_fully_operational():
    """Add 'fully_operational' to the status CHECK constraint."""
    db_path = Path(__file__).parent / "data" / "ship.db"

    if not db_path.exists():
        print(f"Database not found at {db_path}")
        return

    async with aiosqlite.connect(db_path) as db:
        print("Starting migration to add 'fully_operational' status...")

        # Create a new table with the updated CHECK constraint
        await db.execute("""
            CREATE TABLE system_states_new (
                id TEXT PRIMARY KEY,
                ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'operational' CHECK(status IN ('fully_operational', 'operational', 'degraded', 'compromised', 'critical', 'destroyed', 'offline')),
                value REAL NOT NULL DEFAULT 100,
                max_value REAL NOT NULL DEFAULT 100,
                unit TEXT DEFAULT '%',
                category TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        print("  Created new system_states table with updated schema")

        # Copy all data from the old table to the new table
        await db.execute("""
            INSERT INTO system_states_new (id, ship_id, name, status, value, max_value, unit, category, created_at, updated_at)
            SELECT id, ship_id, name, status, value, max_value, unit, category, created_at, updated_at
            FROM system_states
        """)
        print("  Copied all data from old table to new table")

        # Drop the old table
        await db.execute("DROP TABLE system_states")
        print("  Dropped old system_states table")

        # Rename the new table to the original name
        await db.execute("ALTER TABLE system_states_new RENAME TO system_states")
        print("  Renamed new table to system_states")

        await db.commit()
        print("\nMigration completed successfully!")
        print("The database now supports the 'fully_operational' status.")


if __name__ == "__main__":
    asyncio.run(migrate_add_fully_operational())
