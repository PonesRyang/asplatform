from config_loader import get
from .ai_service import AIService
from .literature_service import LiteratureService
from .reference_verifier import ReferenceVerifier

# AI Configuration from config
AI_CONFIG = {
    'api_key': get('ai.api_key', 'your-api-key-here'),
    'base_url': get('ai.base_url', 'https://api.deepseek.com/v1'),
    'model': get('ai.model', 'deepseek-reasoner'),
    'temperature': get('ai.temperature', 0.7),
    'max_tokens': get('ai.max_tokens', 4000)
}

# Singleton instances
ai_service = AIService(AI_CONFIG)
literature_service = LiteratureService()
