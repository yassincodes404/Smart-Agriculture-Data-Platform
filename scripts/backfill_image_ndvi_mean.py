#!/usr/bin/env python3
"""
Backfill ndvi_mean on land_images (NDVI type) by joining nearest land_crops row.

Usage:
  python scripts/backfill_image_ndvi_mean.py
  python scripts/backfill_image_ndvi_mean.py --land-id 42
  python scripts/backfill_image_ndvi_mean.py --dry-run
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow running from repo root without installing the package
ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "services" / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.db.session import SessionLocal  # noqa: E402
from app.lands import repository  # noqa: E402
from app.models.land import Land  # noqa: E402


def backfill_land(db, land_id: int, *, dry_run: bool = False) -> int:
    updated = repository.backfill_image_ndvi_means(db, land_id)
    if dry_run:
        db.rollback()
    else:
        db.commit()
    return updated


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill ndvi_mean on NDVI satellite images")
    parser.add_argument("--land-id", type=int, help="Process a single land_id (default: all lands)")
    parser.add_argument("--dry-run", action="store_true", help="Report changes without committing")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.land_id is not None:
            land_ids = [args.land_id]
        else:
            land_ids = [int(r.land_id) for r in db.query(Land.land_id).all()]

        total = 0
        for land_id in land_ids:
            count = backfill_land(db, land_id, dry_run=args.dry_run)
            if count:
                action = "would update" if args.dry_run else "updated"
                print(f"land_id={land_id}: {action} {count} image(s)")
            total += count

        suffix = " (dry run)" if args.dry_run else ""
        print(f"Done — {total} image(s) backfilled{suffix}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())