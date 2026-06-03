"""
Configuration loader with hot-reload support.
Supports YAML configuration format with automatic reload on file changes.
"""
import yaml
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileModifiedEvent


class ConfigChangeHandler(FileSystemEventHandler):
    """Handler for config file changes."""
    
    def __init__(self, config_manager: 'ConfigManager'):
        self.config_manager = config_manager
        self._debounce_timer: Optional[threading.Timer] = None
    
    def on_modified(self, event):
        if isinstance(event, FileModifiedEvent):
            if event.src_path.endswith('.yaml') or event.src_path.endswith('.yml'):
                # Debounce reload to avoid multiple reloads on single save
                if self._debounce_timer:
                    self._debounce_timer.cancel()
                self._debounce_timer = threading.Timer(0.5, self._reload_config)
                self._debounce_timer.start()
    
    def _reload_config(self):
        print(f"🔄 Reloading configuration from {self.config_manager.config_path}...")
        try:
            self.config_manager.load_config()
            print("✅ Configuration reloaded successfully!")
        except Exception as e:
            print(f"❌ Failed to reload configuration: {e}")


class ConfigManager:
    """
    Singleton configuration manager with hot-reload support.
    """
    _instance: Optional['ConfigManager'] = None
    _lock = threading.Lock()
    
    def __new__(cls, config_path: str = None):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self, config_path: str = None):
        if hasattr(self, '_initialized') and self._initialized:
            return
            
        self._initialized = True
        self._config: Dict[str, Any] = {}
        self._config_path = config_path or self._find_config_file()
        self._observer: Optional[Observer] = None
        self._callbacks: list = []
        
        if self._config_path:
            self.load_config()
    
    def _find_config_file(self) -> str:
        """Find config file in common locations."""
        possible_paths = [
            Path(__file__).parent / 'config.yaml',
            Path(__file__).parent / 'config.yml',
            Path.cwd() / 'config.yaml',
            Path.cwd() / 'config.yml',
        ]
        
        for path in possible_paths:
            if path.exists():
                return str(path)
        
        # Return default path even if it doesn't exist yet
        return str(Path(__file__).parent / 'config.yaml')
    
    def load_config(self) -> Dict[str, Any]:
        """Load configuration from YAML file."""
        try:
            with open(self._config_path, 'r', encoding='utf-8') as f:
                self._config = yaml.safe_load(f) or {}
            
            # Notify callbacks
            for callback in self._callbacks:
                try:
                    callback(self._config)
                except Exception as e:
                    print(f"Callback error: {e}")
            
            return self._config
        except FileNotFoundError:
            print(f"⚠️  Config file not found: {self._config_path}")
            self._config = self._get_default_config()
            return self._config
        except yaml.YAMLError as e:
            print(f"❌ YAML parsing error: {e}")
            raise
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Return default configuration."""
        return {
            'database': {
                'url': 'sqlite:///./sql_app.db'
            },
            'jwt': {
                'secret_key': 'YOUR_SUPER_SECRET_KEY',
                'algorithm': 'HS256',
                'access_token_expire_minutes': 30
            },
            'cors': {
                'allowed_origins': [
                    'http://localhost:5173',
                    'http://localhost:5174',
                    'http://localhost:5175',
                    'http://localhost:5176'
                ]
            },
            'admin': {
                'default_username': 'admin',
                'default_password': 'admin123'
            },
            'ai': {
                'api_key': 'your-api-key-here',
                'base_url': 'https://api.deepseek.com/v1',
                'model': 'deepseek-reasoner',
                'temperature': 0.7,
                'max_tokens': 4000
            },
            'server': {
                'host': '0.0.0.0',
                'port': 8000,
                'reload': True
            },
            'domain_routes': {},
            'static': {
                'html_dir': 'html'
            }
        }
    
    def start_hot_reload(self):
        """Start watching for config file changes."""
        if self._observer:
            return
        
        config_dir = str(Path(self._config_path).parent)
        self._observer = Observer()
        handler = ConfigChangeHandler(self)
        self._observer.schedule(handler, config_dir, recursive=False)
        self._observer.start()
        print(f"👁️  Watching config file for changes: {self._config_path}")
    
    def stop_hot_reload(self):
        """Stop watching for config file changes."""
        if self._observer:
            self._observer.stop()
            self._observer.join()
            self._observer = None
    
    def register_callback(self, callback):
        """Register a callback to be called when config changes."""
        self._callbacks.append(callback)
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value by dot-notation key."""
        keys = key.split('.')
        value = self._config

        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default

        # If the value is None but we have a default, return the default
        if value is None and default is not None:
            return default
        
        return value
    
    def get_all(self) -> Dict[str, Any]:
        """Get entire configuration."""
        return self._config.copy()
    
    @property
    def config_path(self) -> str:
        return self._config_path


# Global config manager instance
config_manager: Optional[ConfigManager] = None


def get_config_manager(config_path: str = None) -> ConfigManager:
    """Get or create the global config manager instance."""
    global config_manager
    if config_manager is None:
        config_manager = ConfigManager(config_path)
    return config_manager


def reload_config() -> Dict[str, Any]:
    """Reload configuration manually."""
    return get_config_manager().load_config()


# Convenience functions for direct access
def get(key: str, default: Any = None) -> Any:
    """Get configuration value."""
    value = get_config_manager().get(key, default)
    # Ensure we never return None if a default is provided
    if value is None and default is not None:
        return default
    return value


def get_all() -> Dict[str, Any]:
    """Get all configuration."""
    return get_config_manager().get_all()


def start_hot_reload():
    """Start hot-reload watcher."""
    get_config_manager().start_hot_reload()


def stop_hot_reload():
    """Stop hot-reload watcher."""
    get_config_manager().stop_hot_reload()
