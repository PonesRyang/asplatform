# Academic Support Platform — 改动目标清单

> 创建于 2026-06-03，共 7 大类 18 条

---

## 1. Prompt 后台配置与版本管理

### 1.1 新建 PromptTemplate 表
- **表名**: `prompt_templates`
- **字段**:
  - `id`, `name`, `mode` (polish/translate/grammar/abstract/outline/fulltext/topic_generate/...)
  - `system_prompt` TEXT
  - `user_prompt_template` TEXT（支持 `{topic}`, `{discipline}`, `{language}` 等变量占位）
  - `variables` JSON（变量列表及说明）
  - `model`, `temperature`, `max_tokens`
  - `is_active` BOOL, `is_published` BOOL
  - `version` INT, `previous_version_id` INT（回滚链）
  - `created_at`, `updated_at`

### 1.2 管理端 CRUD API + 版本发布/回滚
- `GET    /api/admin/prompts` — 列表
- `POST   /api/admin/prompts` — 创建草稿
- `PUT    /api/admin/prompts/{id}` — 编辑
- `POST   /api/admin/prompts/{id}/publish` — 发布（version+1）
- `POST   /api/admin/prompts/{id}/rollback` — 回滚到上一版本
- `DELETE /api/admin/prompts/{id}` — 删除（仅草稿）

### 1.3 生成路由改为从 DB 读取模板 + 变量替换
- `api/ai.py` 的 `process_text()` 和各生成路由改为 `PromptTemplateService.render(mode, vars)` 获取拼好的 prompt
- 不再硬编码 prompt 字符串

### 1.4 GenerationLog 绑定 prompt_version_id
- 见 2.1，日志表加 `prompt_template_id` + `prompt_version` 外键

---

## 2. 生成过程和结果记录

### 2.1 新建 GenerationLog 表
- **表名**: `generation_logs`
- **字段**:
  - `id`, `token_id`, `project_id`, `user_id`
  - `mode` (polish/outline/fulltext/topic_generate/...)
  - `input_text` TEXT（用户输入原文）
  - `search_results` JSON（文献检索结果快照）
  - `final_prompt` TEXT（最终发给模型的 prompt）
  - `model_response` TEXT（模型原始返回）
  - `output_content` TEXT（后处理后的最终内容）
  - `model`, `temperature`, `max_tokens`
  - `prompt_tokens` INT, `completion_tokens` INT, `total_tokens` INT
  - `duration_ms` INT
  - `status` ENUM (success/failed/timeout)
  - `error_message` TEXT
  - `prompt_template_id` INT, `prompt_version` INT
  - `created_at` DATETIME

### 2.2 全流程埋点
- `api/dependencies.py` `deduct_token_quota()` → 写日志（成功/失败/超时）
- `api/ai.py` `process_text()` → 写日志
- `api/thesis.py` `generate_outline()`, `generate_fulltext()` → 写日志
- `api/topic.py` `generate_research_topics()`, `analyze_research_topic()` → 写日志

---

## 3. 代码工程化和模块边界

### 3.1 print() → logging 模块
- 全局搜索 `print()` → 替换为 `logging.info()` / `logging.warning()` / `logging.error()`
- 在 `main.py` 或 `config_loader.py` 初始化 `logging.basicConfig()`
- 支持日志级别配置: `config.yaml` → `logging.level: INFO`
- 支持日志输出: 控制台 + 文件

### 3.2 补充单元测试
- 覆盖模块: `services/ai_service.py`, `services/literature_service.py`, `utils/auth.py`, `utils/security.py`
- 框架: pytest
- Mock 外部 API 调用（httpx）

---

## 4. 文献检索数据源配置

### 4.1 config.yaml 增加配置段
```yaml
literature:
  cache_ttl: 3600
  sources:
    pubmed:
      enabled: true
      priority: 1
      timeout: 15
      max_results: 10
    crossref:
      enabled: true
      priority: 2
      timeout: 10
      max_results: 10
    europepmc:
      enabled: true
      priority: 3
      timeout: 10
      max_results: 10
    arxiv:
      enabled: false
      priority: 4
      timeout: 10
      max_results: 5
```

### 4.2 LiteratureService 适配
- `__init__` 改为从 config 读取数据源列表
- `search_literature()` 按 `enabled` + `priority` 动态选择数据源
- 超时、返回数量从配置取值而非硬编码

---

## 5. RAG / 检索增强流程

### 5.1 抽取 RAGPipeline 服务类
- **位置**: `services/rag_pipeline.py`
- **流程链**:
  ```
  QueryRewriter.rewrite(query)           # 查询词改写（可选）
    → LiteratureSearcher.search(query)    # 按配置多源检索
    → ResultCleaner.clean(results)        # 去重/排序/截断/相关性过滤
    → ContextInjector.inject(template, results)  # 注入 prompt 模板
  ```
- 每步输出可记录（对应 2.1 的 search_results 字段）

### 5.2 路由统一调用
- `api/thesis.py` `generate_outline()` / `generate_fulltext()` 
- `api/topic.py` `create_thesis_from_topic_and_generate_outline()`
- 以上路由的手动拼 prompt 逻辑改为调用 `RAGPipeline.run()`

---

## 6. 用户、产品、订单和权益接入

### 6.1 新增 ExternalUser 表 + API
- **表名**: `external_users`
- **字段**: `id`, `external_id` (你们系统的 user_id), `entitlement_level`, `metadata` JSON
- `POST /api/auth/external/verify` — 校验用户身份 + 权益
- 支持你们系统通过 API Key + user_id 调用

### 6.2 Token 链路适配
- Token 创建时可选绑定 `external_user_id`
- `verify_service_access()` 扣减前增加权益校验回调
- 生成失败时 `deduct_token_quota()` 自动退还
- 积分/额度扣减事件写入 `generation_logs`

### 6.3 对账接口
- `GET /api/admin/reconciliation?from=...&to=...&token_id=...`
- 返回: 总调用次数、总 token 消耗、成功/失败次数、按 mode 分组统计

---

## 7. 部署和运维交付

### 7.1 Docker 部署
- `Dockerfile`: 基于 `python:3.11-slim`，安装依赖，COPY 代码
- `docker-compose.yml`: app + MySQL + 可选 Redis
- 环境变量覆盖 config.yaml（数据库连接等敏感项）

### 7.2 MySQL 迁移
- SQLite → MySQL DDL 迁移脚本
- Alembic 版本管理（如需要）

### 7.3 部署文档
- `DEPLOY.md`:
  - 环境要求（Python 3.11+, MySQL 8.0+）
  - 配置项说明（config.yaml 每项含义）
  - Docker 部署步骤
  - 资源限制建议（CPU/内存/并发连接池）
  - 日志文件位置和级别
  - 常见异常处理（AI 超时、DB 断连、磁盘满）
  - 健康检查端点 `/`
