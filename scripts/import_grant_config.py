from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Iterable

from sqlalchemy import inspect, text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from database import Base, get_db_manager, get_engine
from models import GrantConfigItem


SEED_FILE = ROOT / "data" / "grant_config_seed.json"


def _normalize(value: str) -> str:
    return str(value or "").strip()


def _ensure_incremental_schema() -> None:
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("grant_config_items")}
    statements = []
    if "depends_on_category" not in columns:
        statements.append("ALTER TABLE grant_config_items ADD COLUMN depends_on_category VARCHAR(64)")
    if "depends_on_value" not in columns:
        statements.append("ALTER TABLE grant_config_items ADD COLUMN depends_on_value VARCHAR(255)")
    if statements:
        with engine.begin() as conn:
            for statement in statements:
                conn.execute(text(statement))


def _get_or_create_item(
    db,
    *,
    category: str,
    label: str,
    parent_id: int | None,
    sort_order: int,
    source: str,
    depends_on_category: str | None,
    depends_on_value: str | None,
) -> GrantConfigItem:
    value = _normalize(label)
    item = db.query(GrantConfigItem).filter(
        GrantConfigItem.category == category,
        GrantConfigItem.value == value,
        GrantConfigItem.parent_id == parent_id,
    ).first()
    if item:
        item.label = label
        item.sort_order = min(item.sort_order or sort_order, sort_order)
        item.source = item.source or source
        item.depends_on_category = depends_on_category
        item.depends_on_value = depends_on_value
        item.is_active = True
        return item

    item = GrantConfigItem(
        category=category,
        label=label,
        value=value,
        parent_id=parent_id,
        depends_on_category=depends_on_category,
        depends_on_value=depends_on_value,
        sort_order=sort_order,
        source=source,
        is_active=True,
    )
    db.add(item)
    db.flush()
    return item


def import_seed(rows: dict[str, Iterable[dict]]) -> dict[str, int]:
    _ensure_incremental_schema()
    db = get_db_manager().get_session()
    counts: dict[str, int] = {}
    try:
        for category, entries in rows.items():
            imported = 0
            sibling_order: dict[tuple[str, int | None], int] = {}

            for entry in entries:
                path = [_normalize(part) for part in entry.get("path", []) if _normalize(part)]
                source = _normalize(entry.get("source") or "seed")
                depends_on = entry.get("dependsOn") or {}
                depends_on_category = _normalize(depends_on.get("category") or "") or None
                depends_on_value = _normalize(depends_on.get("value") or "") or None
                parent_id = None

                for label in path:
                    key = (category, parent_id)
                    sibling_order[key] = sibling_order.get(key, 0) + 1
                    item = _get_or_create_item(
                        db,
                        category=category,
                        label=label,
                        parent_id=parent_id,
                        sort_order=sibling_order[key],
                        source=source,
                        depends_on_category=depends_on_category,
                        depends_on_value=depends_on_value,
                    )
                    parent_id = item.id
                if path:
                    imported += 1

            counts[category] = imported

        db.commit()
        return counts
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    seed = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    counts = import_seed(seed)
    print(json.dumps(counts, ensure_ascii=False))


if __name__ == "__main__":
    main()
