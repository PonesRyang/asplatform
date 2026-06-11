from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
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
    grant_projects = relationship("GrantProject", back_populates="token_owner")

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


class GrantProject(Base):
    __tablename__ = "grant_projects"
    id = Column(Integer, primary_key=True, index=True)
    token_id = Column(Integer, ForeignKey("tokens.id"), nullable=True)
    admin_id = Column(Integer, ForeignKey("admin_users.id"), nullable=True)
    title = Column(String(255))
    status = Column(String(64), default="draft")
    current_step = Column(String(32), default="input")
    fund_type = Column(String(64))
    research_area_path = Column(Text)  # JSON string list
    subject = Column(Text)
    disease_path = Column(Text)  # JSON string list
    phenotype = Column(String(255))
    variable_type = Column(String(64))
    variable_name = Column(String(255))
    keywords_json = Column(Text, nullable=True)
    references_json = Column(Text, nullable=True)
    topics_json = Column(Text, nullable=True)
    report_sections_json = Column(Text, nullable=True)
    proposal_sections_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    token_owner = relationship("TokenRecord", back_populates="grant_projects")
    admin_owner = relationship("AdminUser")
    steps = relationship("GrantStep", back_populates="project", cascade="all, delete-orphan")


class GrantStep(Base):
    __tablename__ = "grant_steps"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("grant_projects.id"))
    step_key = Column(String(32))
    status = Column(String(64), default="ready")
    input_json = Column(Text, nullable=True)
    output_json = Column(Text, nullable=True)
    raw_text = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))

    project = relationship("GrantProject", back_populates="steps")


class GrantConfigItem(Base):
    __tablename__ = "grant_config_items"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(64), index=True)
    label = Column(String(255), index=True)
    value = Column(String(255), index=True)
    parent_id = Column(Integer, ForeignKey("grant_config_items.id"), nullable=True, index=True)
    depends_on_category = Column(String(64), nullable=True, index=True)
    depends_on_value = Column(String(255), nullable=True, index=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    source = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))


class LiteratureDatabaseConfig(Base):
    __tablename__ = "literature_database_configs"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(64), unique=True, index=True)
    name = Column(String(255), index=True)
    description = Column(Text, nullable=True)
    modules = Column(String(255), default="all")  # Comma separated: all,grant,writing,literature
    is_enabled = Column(Boolean, default=True)
    default_selected = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
