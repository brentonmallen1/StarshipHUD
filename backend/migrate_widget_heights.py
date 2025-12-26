#!/usr/bin/env python3
"""
Migration script to double widget heights for new rowHeight setting.

This migrates existing widgets from the old rowHeight (100px) to the new
rowHeight (50px) by doubling their height values to maintain the same
visual size.

Usage:
    python migrate_widget_heights.py
"""

import asyncio
import aiosqlite
from pathlib import Path


async def migrate_widget_heights():
    """Double the height of all widgets and adjust their Y positions."""
    db_path = Path(__file__).parent / "data" / "starship.db"

    if not db_path.exists():
        print(f"Database not found at {db_path}")
        return

    async with aiosqlite.connect(db_path) as db:
        # Get all widgets
        async with db.execute("SELECT id, y, height FROM widget_instances") as cursor:
            widgets = await cursor.fetchall()

        if not widgets:
            print("No widgets found in database")
            return

        print(f"Found {len(widgets)} widgets to migrate")

        # Double the height and adjust Y position for each widget
        for widget_id, y, height in widgets:
            new_y = y * 2
            new_height = height * 2

            await db.execute(
                "UPDATE widget_instances SET y = ?, height = ? WHERE id = ?",
                (new_y, new_height, widget_id)
            )

            print(f"  Widget {widget_id}: y {y} → {new_y}, height {height} → {new_height}")

        await db.commit()
        print(f"\nSuccessfully migrated {len(widgets)} widgets!")


if __name__ == "__main__":
    asyncio.run(migrate_widget_heights())
