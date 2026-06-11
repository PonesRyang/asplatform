from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import LiteratureDatabaseConfig


SUPPORTED_LITERATURE_DATABASES = [
    {
        "key": "pubmed",
        "name": "PubMed",
        "description": "生命科学与医学文献数据库，适合医学、药学、生物学主题。",
        "modules": "all",
        "is_enabled": True,
        "default_selected": True,
        "sort_order": 10,
    },
    {
        "key": "europepmc",
        "name": "Europe PMC",
        "description": "欧洲生命科学文献库，覆盖论文、预印本与基金成果。",
        "modules": "all",
        "is_enabled": True,
        "default_selected": True,
        "sort_order": 20,
    },
    {
        "key": "crossref",
        "name": "CrossRef",
        "description": "跨学科 DOI 元数据检索，适合通用学术文献补充。",
        "modules": "all",
        "is_enabled": True,
        "default_selected": True,
        "sort_order": 30,
    },
    {
        "key": "arxiv",
        "name": "arXiv",
        "description": "预印本文献库，适合计算机、数学、物理等方向。",
        "modules": "all",
        "is_enabled": True,
        "default_selected": False,
        "sort_order": 40,
    },
]


SUPPORTED_LITERATURE_DATABASE_KEYS = {item["key"] for item in SUPPORTED_LITERATURE_DATABASES}


def ensure_literature_database_seed(db: Session) -> None:
    existing = {
        item.key: item
        for item in db.query(LiteratureDatabaseConfig)
        .filter(LiteratureDatabaseConfig.key.in_(SUPPORTED_LITERATURE_DATABASE_KEYS))
        .all()
    }
    changed = False
    for seed in SUPPORTED_LITERATURE_DATABASES:
        if seed["key"] in existing:
            continue
        db.add(LiteratureDatabaseConfig(**seed))
        changed = True
    if changed:
        db.commit()


def _module_matches(modules: Optional[str], module: Optional[str]) -> bool:
    if not module:
        return True
    values = {part.strip() for part in (modules or "all").split(",") if part.strip()}
    return "all" in values or module in values


def list_literature_database_configs(
    db: Session,
    module: Optional[str] = None,
    include_disabled: bool = False,
) -> List[LiteratureDatabaseConfig]:
    ensure_literature_database_seed(db)
    query = db.query(LiteratureDatabaseConfig)
    if not include_disabled:
        query = query.filter(LiteratureDatabaseConfig.is_enabled == True)
    items = query.order_by(
        LiteratureDatabaseConfig.sort_order.asc(),
        LiteratureDatabaseConfig.id.asc(),
    ).all()
    return [item for item in items if _module_matches(item.modules, module)]


def default_literature_databases(db: Session, module: Optional[str] = None) -> List[str]:
    defaults = [
        item.key
        for item in list_literature_database_configs(db, module=module)
        if item.default_selected
    ]
    if defaults:
        return defaults
    return [item.key for item in list_literature_database_configs(db, module=module)[:1]]


def normalize_literature_databases(
    db: Session,
    databases: Optional[Iterable[str]],
    module: Optional[str] = None,
) -> List[str]:
    allowed = {item.key for item in list_literature_database_configs(db, module=module)}
    if not databases:
        return default_literature_databases(db, module=module)

    normalized = []
    for database in databases:
        key = (database or "").strip().lower()
        if key and key not in normalized:
            normalized.append(key)

    unknown = [key for key in normalized if key not in SUPPORTED_LITERATURE_DATABASE_KEYS]
    if unknown:
        raise HTTPException(status_code=400, detail=f"不支持的文献库：{', '.join(unknown)}")

    disabled = [key for key in normalized if key not in allowed]
    if disabled:
        raise HTTPException(status_code=400, detail=f"文献库未启用或不适用于当前模块：{', '.join(disabled)}")

    return normalized or default_literature_databases(db, module=module)


def update_literature_database_config(
    item: LiteratureDatabaseConfig,
    updates: dict,
) -> LiteratureDatabaseConfig:
    for key in ["name", "description", "modules", "is_enabled", "default_selected", "sort_order"]:
        if key in updates:
            setattr(item, key, updates[key])
    item.updated_at = datetime.now(timezone.utc)
    return item
