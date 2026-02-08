"""
Build-time script to create a pre-seeded template database.

Run during `docker build` to bake demo data into the image so
first-time users get instant startup without waiting for seed.

Usage:
    python -m app.create_template_db /app/template.db
"""

import asyncio
import sys
from pathlib import Path

import aiosqlite


async def create_template(output_path: str):
    from app.database import SCHEMA
    from app.migrations import apply_migrations
    from app.seed import seed_database

    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)

    async with aiosqlite.connect(str(path)) as db:
        await db.execute("PRAGMA foreign_keys = ON")
        await db.executescript(SCHEMA)
        await db.commit()

        await apply_migrations(db)
        await seed_database(db)

    print(f"[template] Created pre-seeded database at {output_path}")


if __name__ == "__main__":
    output = sys.argv[1] if len(sys.argv) > 1 else "/app/template.db"
    asyncio.run(create_template(output))
