from schemas.auth import (
    Token,
    TokenCreate,
    TokenBatchCreate,
    TokenBatchDelete,
    TokenResponse,
)
from schemas.admin import (
    UserGroupBase,
    UserGroupCreate,
    UserGroupResponse,
    AdminUserBase,
    AdminUserCreate,
    AdminUserUpdate,
    AdminUserResponse,
    PasswordChange,
    AdminPasswordReset,
)
from schemas.ai import (
    AIRequest,
    EnhanceLiteratureRequest,
)
from schemas.thesis import (
    ThesisCreate,
    ThesisCreateFromTopic,
    ThesisOutlineRequest,
    ThesisOutlineSaveRequest,
    ThesisFullTextSaveRequest,
    ThesisDraftSaveRequest,
    ThesisFullTextRequest,
    ThesisRefineRequest,
    ReferenceUploadResponse,
    ThesisProjectResponse,
)
from schemas.topic import (
    TopicGenerationRequest,
    TopicAnalysisRequest,
    TopicRefineRequest,
    ThesisTopic,
    TopicAnalysisResult,
)
from schemas.literature import (
    LiteratureSearchRequest,
    LitCompareRequest,
    GapAnalysisRequest,
)
from schemas.bio import (
    AnalyzeRequest,
)

__all__ = [
    # auth
    "Token",
    "TokenCreate",
    "TokenBatchCreate",
    "TokenBatchDelete",
    "TokenResponse",
    # admin
    "UserGroupBase",
    "UserGroupCreate",
    "UserGroupResponse",
    "AdminUserBase",
    "AdminUserCreate",
    "AdminUserUpdate",
    "AdminUserResponse",
    "PasswordChange",
    "AdminPasswordReset",
    # ai
    "AIRequest",
    "EnhanceLiteratureRequest",
    # thesis
    "ThesisCreate",
    "ThesisCreateFromTopic",
    "ThesisOutlineRequest",
    "ThesisOutlineSaveRequest",
    "ThesisFullTextSaveRequest",
    "ThesisDraftSaveRequest",
    "ThesisFullTextRequest",
    "ThesisRefineRequest",
    "ReferenceUploadResponse",
    "ThesisProjectResponse",
    # topic
    "TopicGenerationRequest",
    "TopicAnalysisRequest",
    "TopicRefineRequest",
    "ThesisTopic",
    "TopicAnalysisResult",
    # literature
    "LiteratureSearchRequest",
    "LitCompareRequest",
    "GapAnalysisRequest",
    # bio
    "AnalyzeRequest",
]
