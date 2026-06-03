from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base

class UserGroup(Base):
    __tablename__ = "user_groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True)
    description = Column(String(255))
    permissions = Column(String(255))  # Comma separated: "user:read,user:write"
    
    users = relationship("AdminUser", back_populates="group")

class AdminUser(Base):
    __tablename__ = "admin_users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, index=True)
    hashed_password = Column(String(255))
    full_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    group_id = Column(Integer, ForeignKey("user_groups.id"), nullable=True)
    
    group = relationship("UserGroup", back_populates="users")

class TokenRecord(Base):
    __tablename__ = "tokens"
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(255), unique=True, index=True)
    name = Column(String(255))
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    ai_quota = Column(Integer, default=1000000) # Total token count allowed (input + output tokens)
    used_quota = Column(Integer, default=0) # Total tokens used (input + output tokens)
    permissions = Column(String(255), default="all") # Comma separated permissions: "bio,ai"
    
    projects = relationship("ThesisProject", back_populates="token_owner")

class ThesisProject(Base):
    __tablename__ = "thesis_projects"
    id = Column(Integer, primary_key=True, index=True)
    token_id = Column(Integer, ForeignKey("tokens.id"), nullable=True)
    admin_id = Column(Integer, ForeignKey("admin_users.id"), nullable=True)
    title = Column(String(255))
    topic = Column(String(255))
    discipline = Column(String(255))
    language = Column(String(32), default="zh")
    length = Column(String(64))
    style = Column(String(64))
    thesis_type = Column(String(64))
    current_step = Column(Integer, default=1)
    reference_files = Column(Text, nullable=True)  # JSON: list of verified reference metadata
    style_example_file = Column(Text, nullable=True)  # JSON: style example metadata
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    
    token_owner = relationship("TokenRecord", back_populates="projects")
    admin_owner = relationship("AdminUser")
    steps = relationship("ThesisStep", back_populates="project", cascade="all, delete-orphan")

class ThesisStep(Base):
    __tablename__ = "thesis_steps"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("thesis_projects.id"))
    step_num = Column(Integer)
    content = Column(Text) # JSON or markdown content
    metadata_info = Column(Text) # JSON string for extra info like references
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    
    project = relationship("ThesisProject", back_populates="steps")


class GenerationLog(Base):
    """生成过程与结果完整记录"""
    __tablename__ = "generation_logs"

    id = Column(Integer, primary_key=True, index=True)
    token_id = Column(Integer, ForeignKey("tokens.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("thesis_projects.id"), nullable=True)
    prompt_template_id = Column(Integer, nullable=True)
    prompt_version = Column(Integer, nullable=True)

    mode = Column(String(64))  # polish / outline / fulltext / topic_generate / translate / ...
    input_text = Column(Text)  # 用户输入原文
    search_results = Column(Text)  # JSON: 文献检索结果快照
    final_prompt = Column(Text)  # 最终发给模型的 prompt
    model_response = Column(Text)  # 模型原始返回
    output_content = Column(Text)  # 后处理后的最终内容
    model = Column(String(64))
    temperature = Column(Float)
    max_tokens = Column(Integer)

    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    duration_ms = Column(Integer, nullable=True)
    status = Column(String(32), default="pending")  # pending / success / failed / timeout
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))

    token_owner = relationship("TokenRecord")
    project = relationship("ThesisProject")
