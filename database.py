"""
Database configuration and connection management.
Supports SQLite, MySQL, and PostgreSQL.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
from typing import Optional, Dict, Any
import os

from config_loader import get


# Declarative base for models
Base = declarative_base()


class DatabaseManager:
    """
    Database connection manager with support for multiple database types.
    """
    
    _instance: Optional['DatabaseManager'] = None
    _engine = None
    _SessionLocal = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._engine is None:
            self._init_database()
    
    def _init_database(self):
        """Initialize database connection based on configuration."""
        db_config = self._get_database_config()
        db_type = db_config.get('type', 'sqlite')
        
        print(f"📊 Initializing {db_type.upper()} database connection...")
        
        if db_type == 'sqlite':
            self._engine = self._create_sqlite_engine(db_config)
        elif db_type == 'mysql':
            self._engine = self._create_mysql_engine(db_config)
        elif db_type == 'postgresql':
            self._engine = self._create_postgresql_engine(db_config)
        else:
            raise ValueError(f"Unsupported database type: {db_type}. "
                           f"Supported types: sqlite, mysql, postgresql")
        
        # Create session factory
        self._SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self._engine
        )
        
        print(f"✅ Database connection established successfully!")
    
    def _get_database_config(self) -> Dict[str, Any]:
        """Get database configuration."""
        return {
            'type': get('database.type', 'sqlite'),
            'url': get('database.url', 'sqlite:///./sql_app.db'),
            'host': get('database.host', None),
            'port': get('database.port', None),
            'database': get('database.database', None),
            'username': get('database.username', None),
            'password': get('database.password', None),
            'pool_size': get('database.pool_size', 5),
            'max_overflow': get('database.max_overflow', 10),
            'pool_recycle': get('database.pool_recycle', 3600),
            'pool_pre_ping': get('database.pool_pre_ping', True),
        }
    
    def _create_sqlite_engine(self, config: Dict[str, Any]):
        """Create SQLite database engine."""
        # SQLite doesn't use connection pooling in the same way
        # Use StaticPool for in-memory or regular file database
        return create_engine(
            config['url'],
            connect_args={"check_same_thread": False},
            echo=False,  # Set to True for SQL debugging
            poolclass=StaticPool,
        )
    
    def _create_mysql_engine(self, config: Dict[str, Any]):
        """Create MySQL database engine."""
        # Build URL if not provided
        url = config['url']
        if not url and config.get('host'):
            url = (
                f"mysql+pymysql://{config['username']}:{config['password']}"
                f"@{config['host']}:{config.get('port', 3306)}/{config['database']}"
                f"?charset=utf8mb4"
            )
        
        return create_engine(
            url,
            pool_size=config['pool_size'],
            max_overflow=config['max_overflow'],
            pool_recycle=config['pool_recycle'],
            pool_pre_ping=config['pool_pre_ping'],
            echo=False,
        )
    
    def _create_postgresql_engine(self, config: Dict[str, Any]):
        """Create PostgreSQL database engine."""
        # Build URL if not provided
        url = config['url']
        if not url and config.get('host'):
            url = (
                f"postgresql://{config['username']}:{config['password']}"
                f"@{config['host']}:{config.get('port', 5432)}/{config['database']}"
            )
        
        return create_engine(
            url,
            pool_size=config['pool_size'],
            max_overflow=config['max_overflow'],
            pool_recycle=config['pool_recycle'],
            pool_pre_ping=config['pool_pre_ping'],
            echo=False,
        )
    
    def get_engine(self):
        """Get the database engine."""
        return self._engine
    
    def get_session(self):
        """Get a database session."""
        if self._SessionLocal is None:
            raise RuntimeError("Database not initialized. Call init_database first.")
        return self._SessionLocal()
    
    def close(self):
        """Close database connections."""
        if self._engine:
            self._engine.dispose()
            print("🔒 Database connections closed.")


# Convenience functions
def get_db_manager() -> DatabaseManager:
    """Get or create the database manager instance."""
    return DatabaseManager()


def get_db():
    """
    Dependency for FastAPI routes.
    Yields database sessions.
    """
    db = get_db_manager().get_session()
    try:
        yield db
    finally:
        db.close()


def init_database():
    """Initialize database connection."""
    return get_db_manager()


def get_engine():
    """Get database engine."""
    return get_db_manager().get_engine()
