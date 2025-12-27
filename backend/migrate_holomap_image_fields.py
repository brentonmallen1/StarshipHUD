"""
Migration: Add image scale and offset fields to holomap_layers table.
"""

import asyncio
import aiosqlite
from pathlib import Path


async def migrate():
    db_path = Path("data/starship.db")
    if not db_path.exists():
        print("Database does not exist, skipping migration")
        return

    async with aiosqlite.connect(db_path) as db:
        # Check if columns already exist
        cursor = await db.execute("PRAGMA table_info(holomap_layers)")
        columns = {row[1] for row in await cursor.fetchall()}

        if "image_scale" not in columns:
            print("Adding image_scale column...")
            await db.execute(
                "ALTER TABLE holomap_layers ADD COLUMN image_scale REAL NOT NULL DEFAULT 1.0"
            )

        if "image_offset_x" not in columns:
            print("Adding image_offset_x column...")
            await db.execute(
                "ALTER TABLE holomap_layers ADD COLUMN image_offset_x REAL NOT NULL DEFAULT 0.0"
            )

        if "image_offset_y" not in columns:
            print("Adding image_offset_y column...")
            await db.execute(
                "ALTER TABLE holomap_layers ADD COLUMN image_offset_y REAL NOT NULL DEFAULT 0.0"
            )

        await db.commit()
        print("Migration complete!")


if __name__ == "__main__":
    asyncio.run(migrate())
