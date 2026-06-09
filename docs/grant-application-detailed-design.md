# 课题申报功能详细设计文档

## 1. 文档目的

本文用于对比 CNSAI 课题申报功能与当前五页原型，明确当前原型缺失的业务深度，并给出后续在本系统中落地时的详细产品、交互、数据和接口设计。

结论先说：

- 当前原型是“页面结构原型”，只验证了五页流程和跳转。
- CNSAI 实际功能是“选题孵化 + 文献检索 + AI 论证 + 申请书生成”的完整工作台。
- 如果要进入实现阶段，需要把原型从“每页一屏样例”升级为“每页完整工作流”，尤其补足关键词编辑、文献证据、生成历史、报告正文、申请书章节编辑和导出。

## 2. 功能定位

### 2.1 业务目标

帮助用户从一个宽泛研究方向出发，逐步形成可申报基金的课题方案，并最终生成基金申请书初稿。

它不是简单的文本生成器，核心价值在于：

- 把用户输入的申报约束结构化。
- 用关键词和文献检索控制选题边界。
- 给出多个可比较的候选选题。
- 生成选题报告，先判断题目是否值得申报。
- 再生成申请书初稿，并支持后续章节修订。

### 2.2 推荐产品形态

采用“项目 + 五页流程”。

```text
项目列表
  -> 输入选题信息
  -> 选题关键词
  -> 基金选题
  -> 选题报告
  -> 申请书生成
```

五页不是普通 Tab，而是项目内的流程页面。每页都应支持保存、恢复、重新生成和回到上一步。

## 3. CNSAI 功能与当前原型差距

| 模块 | CNSAI 已观察功能 | 当前原型状态 | 需要补足 |
| --- | --- | --- | --- |
| 输入选题信息 | 有课题类型、研究方向、高级选项、级联选择、必填校验 | 只展示已填样例 | 需要真实表单、校验、级联数据、草稿保存 |
| 选题关键词 | 生成 AND/OR 关键词，按六类分组，可勾选调整 | 只展示标签样例 | 需要可编辑关键词池、增删、重新生成、关键词来源说明 |
| 文献检索 | 生成选题前先查文献，返回 PMID、DOI、标题等 | 原型只写“检索后注入” | 需要文献列表、检索进度、无结果兜底、引用选择 |
| 基金选题 | 生成 10 个候选题，默认选择一个，可继续生成报告 | 只展示 3 个题目 | 需要 10 个题卡、评分维度、选择逻辑、编辑题目、生成历史 |
| 选题报告 | 输出完整报告正文、评估、参考文献 | 只展示四个摘要块 | 需要完整正文阅读区、目录、版本、重新生成、局部编辑 |
| 申请书生成 | 生成青年基金申请书初稿，含多个正式章节 | 只展示章节列表 | 需要章节正文、章节状态、逐章重写、引用校验、导出 Word |
| 长任务 | 报告和申请书用流式生成，等待约 60-150 秒 | 原型没有生成态细节 | 需要 SSE 或任务轮询、进度、取消、失败恢复 |
| 错误处理 | 技术路线图出现 Mermaid 语法错误 | 原型只提示风险 | 需要图示源码、错误详情、重新渲染、降级展示 |
| 历史保存 | 页面脚本包含 topics/report/proposal add/list | 原型无历史抽屉 | 需要版本列表、对比、恢复 |

## 4. 页面级详细设计

### 4.1 项目列表页

路由：

```text
/frontend/grant
```

目标：

- 展示用户已有课题申报项目。
- 支持继续未完成流程。
- 支持新建项目。

页面区块：

| 区块 | 内容 |
| --- | --- |
| 顶部操作区 | 新建申报项目、筛选项目状态、搜索题目 |
| 项目表格 | 项目标题、基金类型、研究方向、当前步骤、更新时间、生成状态 |
| 状态筛选 | 全部、草稿、生成中、已完成、失败 |
| 快捷操作 | 继续、复制项目、删除、导出 |

项目状态：

```text
draft
keywords_ready
topics_ready
report_ready
proposal_ready
generating
failed
```

### 4.2 第 1 页：输入选题信息

路由：

```text
/frontend/grant/projects/{project_id}/input
```

目标：

收集影响后续生成质量的申报约束。CNSAI 里高级选项虽然是选填，但实际测试发现填得越完整，选题越聚焦。

字段设计：

| 字段 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| 课题类型 | 单选卡片 | 是 | 国自然青年、面上、地区、省市级、其他 |
| 研究领域/研究方向 | 三级级联 | 是 | 需保存完整路径 |
| 申请书主题 | 多行文本 | 否 | 可输入中文或英文研究主题 |
| 疾病类型/名称 | 级联 + 自定义 | 否 | 如肿瘤 / 黑色素瘤 |
| 表型/科学问题 | 输入 + 推荐词 | 否 | 如 T细胞耗竭 |
| 主变量类型 | 下拉 | 否 | 基因、蛋白、膜受体、通路、细胞群、药物、技术方法等 |
| 主变量名称 | 输入 | 否 | 如 PD-1、pd1、PDCD1 |

页面布局：

- 左侧主表单：基础信息、高级选项、补充说明。
- 右侧辅助面板：填写完整度、示例、下一步会如何使用这些字段。
- 底部操作：保存草稿、开始选题。

校验规则：

- 未选课题类型或研究方向时，不允许进入下一步。
- 研究方向必须保存完整数组，不只保存末级。
- 主题、疾病、表型、变量名支持中英文混输。
- 高级选项为空时可以继续，但提示“选题可能较宽泛”。

生成动作：

点击 `开始选题` 后：

1. 保存当前项目输入。
2. 调用关键词生成接口。
3. 成功后跳转到关键词页。
4. 失败则停留本页，展示错误和重试。

### 4.3 第 2 页：选题关键词

路由：

```text
/frontend/grant/projects/{project_id}/keywords
```

目标：

让用户审核和调整 AI 生成的关键词边界。这个页面决定后续文献召回和候选题方向，是核心控制页。

CNSAI 实测结果：

| 类型 | 结果 |
| --- | --- |
| AND | PD-1 |
| OR | 黑色素瘤、T细胞耗竭、膜受体、pd1、Melanoma、CD8+ T cell、PD-1 signaling pathway、Immune checkpoint inhibitor |
| 分组 | 关联疾病、组织/细胞表型、分子靶点、信号通路、治疗方法、研究技术 |

页面区块：

| 区块 | 功能 |
| --- | --- |
| 必须包含关键词 | 展示 AND 关键词，可编辑、可添加 |
| 可选扩展关键词 | 展示 OR 关键词，可勾选、删除、添加 |
| 分组关键词池 | 按六类展示推荐词 |
| 关键词预览 | 预览检索表达式 |
| 文献召回预估 | 显示可能召回数量或提示 |

交互要求：

- 用户可以添加新关键词。
- 用户可以删除不相关关键词。
- 用户可以把 OR 关键词提升为 AND。
- 用户可以重新生成关键词。
- 修改后必须保存关键词版本。

关键词数据结构：

```ts
interface GrantKeywordResult {
  must: GrantKeyword[];
  should: GrantKeyword[];
  groups: GrantKeywordGroup[];
  searchExpressionPreview: string;
}

interface GrantKeyword {
  id: string;
  text: string;
  language?: 'zh' | 'en' | 'mixed';
  source: 'ai' | 'user' | 'system';
  selected: boolean;
  groupKey?: string;
}
```

下一步动作：

点击 `生成创新选题`：

1. 保存关键词。
2. 调用文献检索。
3. 展示检索进度。
4. 用检索结果调用候选选题生成。
5. 成功后跳转基金选题页。

### 4.4 文献检索中间态

CNSAI 并没有把文献检索做成独立页面，但从脚本可见，生成选题前会调用搜索接口。我们的系统应该把这个过程展示出来，至少作为关键词页到选题页之间的生成状态。

需要展示：

- 当前检索表达式。
- 检索范围，如标题、摘要、关键词。
- 召回文献数量。
- 被用于生成的文献数量。
- 文献列表预览。

文献字段：

```ts
interface GrantReference {
  id: string;
  pmid?: string;
  doi?: string;
  title: string;
  journal?: string;
  year?: number;
  authors?: string[];
  abstractSnippet?: string;
  selectedForGeneration: boolean;
}
```

无结果处理：

- 提示用户关键词过窄。
- 允许回到关键词页放宽 OR 关键词。
- 允许不使用文献继续生成，但要标记风险。

### 4.5 第 3 页：基金选题

路由：

```text
/frontend/grant/projects/{project_id}/topics
```

目标：

展示多个候选课题，让用户选择最终用于报告和申请书的题目。

CNSAI 实测生成 10 个候选题，当前原型只展示了 3 个，这是明显不足。

候选题卡片字段：

| 字段 | 说明 |
| --- | --- |
| 题目 | 候选课题标题 |
| 简述 | 研究问题和机制方向 |
| 创新点 | 相比常规选题的新意 |
| 可行性 | 实验路径是否适合青年基金 |
| 基金匹配度 | 青年/面上/地区项目适配 |
| 关键词命中 | 与 AND/OR 的关联 |
| 文献依据 | 关联参考文献数量和代表文献 |
| 风险 | 题目过大、机制过窄、实验难度等 |

推荐卡片结构：

```text
题目
一句话说明
标签：青年基金适配 / 机制明确 / 文献充分
评分：创新性、可行性、基金匹配、风险
操作：选择、编辑、查看依据
```

交互要求：

- 默认选中第一个候选题，但用户可以切换。
- 支持编辑题目标题。
- 支持查看每个候选题对应的关键词和文献依据。
- 支持重新生成候选题。
- 支持保留历史批次。

候选题数据结构：

```ts
interface GrantCandidateTopic {
  id: string;
  batchId: string;
  title: string;
  description: string;
  innovation?: string;
  feasibility?: string;
  fundFit?: string;
  risk?: string;
  score?: {
    innovation: number;
    feasibility: number;
    fundFit: number;
    evidence: number;
  };
  referenceIds: string[];
  selected: boolean;
}
```

### 4.6 第 4 页：选题报告

路由：

```text
/frontend/grant/projects/{project_id}/report
```

目标：

把候选题变成一份可审阅的立项论证报告。这个页面不是摘要卡片，应展示完整正文。

CNSAI 实测报告结构：

- 题目
- 研究方向
- 选题关键词
- 项目类型
- 研究目的、意义
- 研究内容及实现方案
- 科学问题和科学假说
- 理论依据
- 选题评估
- 参考文献

页面布局：

| 区块 | 说明 |
| --- | --- |
| 左侧目录 | 点击跳转各章节 |
| 中间正文 | 完整报告正文 |
| 右侧信息 | 选题摘要、关键词、参考文献、版本 |
| 底部操作 | 重新生成、局部编辑、生成申请书 |

生成态：

- 进入页面后可以先展示骨架屏。
- 使用流式输出时，章节逐段出现。
- 右上角显示“生成中”“已保存”“失败”等状态。

编辑能力：

- 支持整篇重新生成。
- 支持按章节重新生成。
- 支持用户手动编辑后保存。
- 保存编辑后应生成新版本。

报告数据结构：

```ts
interface GrantTopicReport {
  id: string;
  topicId: string;
  version: number;
  status: 'generating' | 'ready' | 'failed';
  sections: GrantReportSection[];
  referenceIds: string[];
  createdAt: string;
}

interface GrantReportSection {
  key: string;
  title: string;
  markdown: string;
  generatedBy: 'ai' | 'user';
}
```

### 4.7 第 5 页：申请书生成

路由：

```text
/frontend/grant/projects/{project_id}/proposal
```

目标：

基于选题报告生成基金申请书初稿，并支持后续章节修订和导出。

CNSAI 实测申请书结构：

- 中文摘要
- 关键词
- 科学问题属性选择理由
- 项目立项依据
- 项目的研究内容
- 项目的研究目标
- 拟解决的关键科学问题
- 拟采取的研究方案及可行性分析
- 技术路线图
- 年度研究计划及预期研究结果
- 参考文献

当前原型只展示了章节状态，缺少正文区和编辑区，需要补。

推荐页面布局：

| 区块 | 说明 |
| --- | --- |
| 左侧章节目录 | 章节状态、字数、是否已编辑 |
| 中间正文编辑器 | 当前章节完整正文 |
| 右侧工具栏 | 参考文献、AI 改写、风险检查、导出 |
| 顶部状态 | 生成进度、保存状态、版本 |

章节状态：

```text
pending
generating
ready
edited
failed
needs_review
```

章节操作：

- 逐章重新生成。
- 选中段落改写。
- 插入参考文献。
- 检查格式。
- 检查 Mermaid 图示。
- 导出 Word。

申请书数据结构：

```ts
interface GrantProposal {
  id: string;
  projectId: string;
  reportId: string;
  fundType: string;
  version: number;
  sections: GrantProposalSection[];
  references: GrantReference[];
  exportStatus?: 'none' | 'exporting' | 'ready' | 'failed';
}

interface GrantProposalSection {
  key: string;
  title: string;
  markdown: string;
  status: 'pending' | 'generating' | 'ready' | 'edited' | 'failed';
  wordCount?: number;
  updatedAt?: string;
}
```

## 5. 生成任务设计

报告和申请书生成耗时较长，不能用普通同步请求硬等。

### 5.1 推荐方案

首选 SSE 流式输出：

```text
GET /api/ai/grant/projects/{project_id}/report/stream
GET /api/ai/grant/projects/{project_id}/proposal/stream
```

备选后台任务：

```text
POST /api/ai/grant/projects/{project_id}/jobs
GET  /api/ai/grant/jobs/{job_id}
```

### 5.2 任务状态

```text
queued
running
streaming
saving
completed
failed
cancelled
```

### 5.3 页面反馈

- 显示当前阶段：检索文献、生成候选题、生成报告、生成申请书。
- 显示已生成章节。
- 允许取消。
- 失败后保留已生成内容。
- 允许从失败节点重试。

## 6. API 设计

### 6.1 项目

```text
POST /api/ai/grant/projects
GET  /api/ai/grant/projects
GET  /api/ai/grant/projects/{project_id}
PATCH /api/ai/grant/projects/{project_id}
DELETE /api/ai/grant/projects/{project_id}
```

### 6.2 关键词

```text
POST /api/ai/grant/projects/{project_id}/keywords/generate
PATCH /api/ai/grant/projects/{project_id}/keywords
POST /api/ai/grant/projects/{project_id}/keywords/regenerate
```

### 6.3 文献

```text
POST /api/ai/grant/projects/{project_id}/references/search
PATCH /api/ai/grant/projects/{project_id}/references/selection
```

### 6.4 选题

```text
POST /api/ai/grant/projects/{project_id}/topics/generate
PATCH /api/ai/grant/projects/{project_id}/topics/{topic_id}
POST /api/ai/grant/projects/{project_id}/topics/{topic_id}/select
GET  /api/ai/grant/projects/{project_id}/topics/batches
```

### 6.5 报告

```text
POST /api/ai/grant/projects/{project_id}/report/generate
GET  /api/ai/grant/projects/{project_id}/report/stream
PATCH /api/ai/grant/projects/{project_id}/report/sections/{section_key}
POST /api/ai/grant/projects/{project_id}/report/sections/{section_key}/regenerate
GET  /api/ai/grant/projects/{project_id}/report/versions
```

### 6.6 申请书

```text
POST /api/ai/grant/projects/{project_id}/proposal/generate
GET  /api/ai/grant/projects/{project_id}/proposal/stream
PATCH /api/ai/grant/projects/{project_id}/proposal/sections/{section_key}
POST /api/ai/grant/projects/{project_id}/proposal/sections/{section_key}/regenerate
POST /api/ai/grant/projects/{project_id}/proposal/validate-mermaid
POST /api/ai/grant/projects/{project_id}/exports/word
```

## 7. 数据库设计

### 7.1 grant_projects

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | integer | 主键 |
| user_id | integer | 用户 |
| service_token_id | integer | 服务令牌 |
| title | string | 当前题目 |
| fund_type | string | 基金类型 |
| research_area_path | json | 完整研究方向路径 |
| subject | text | 申请书主题 |
| disease_path | json | 疾病路径 |
| phenotype | string | 表型/科学问题 |
| variable_type | string | 主变量类型 |
| variable_name | string | 主变量名称 |
| current_step | string | 当前步骤 |
| status | string | 项目状态 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### 7.2 grant_keywords

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | integer | 主键 |
| project_id | integer | 项目 |
| keyword_type | string | must / should |
| group_key | string | 分组 |
| text | string | 关键词 |
| selected | boolean | 是否选中 |
| source | string | ai / user / system |

### 7.3 grant_references

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | integer | 主键 |
| project_id | integer | 项目 |
| pmid | string | PubMed ID |
| doi | string | DOI |
| title | text | 文献标题 |
| journal | string | 期刊 |
| year | integer | 年份 |
| authors_json | json | 作者 |
| abstract | text | 摘要 |
| selected | boolean | 是否用于生成 |

### 7.4 grant_topics

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | integer | 主键 |
| project_id | integer | 项目 |
| batch_id | string | 生成批次 |
| title | text | 题目 |
| description | text | 简述 |
| score_json | json | 评分 |
| reference_ids_json | json | 参考文献 |
| selected | boolean | 是否最终选择 |

### 7.5 grant_documents

统一保存报告和申请书。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | integer | 主键 |
| project_id | integer | 项目 |
| document_type | string | report / proposal |
| version | integer | 版本 |
| status | string | 状态 |
| sections_json | json | 章节 |
| raw_text | text | 原始生成文本 |
| created_at | datetime | 创建时间 |

## 8. 原型补全清单

当前五页原型需要继续补以下内容，才接近 CNSAI 的功能深度：

1. 输入页补真实表单控件，而不是静态字段。
2. 关键词页补可勾选、可编辑、可提升 AND 的关键词池。
3. 增加文献检索结果区，至少显示 5-10 条文献卡片。
4. 选题页展示完整 10 个候选题，并加评分和依据。
5. 报告页从摘要卡片升级为完整正文阅读页面。
6. 申请书页从章节列表升级为章节目录 + 正文编辑器。
7. 加生成态：骨架屏、进度、流式输出、失败重试。
8. 加历史版本抽屉：候选题批次、报告版本、申请书版本。
9. 加引用管理：引用来源、插入章节、引用缺失提醒。
10. 加 Mermaid 错误兜底：源码、错误、重新生成图示。

## 9. 实施优先级

### P0：先补够可评审原型

- 五页都做成可交互原型。
- 每页补足主要业务区块。
- 选题页至少展示 10 个候选题。
- 报告页和申请书页展示真实章节内容示例。

### P1：前端静态功能

- 新建 `/frontend/grant` 路由。
- 实现项目列表、项目布局、五页路由。
- 本地 mock 数据跑通完整跳转。

### P2：后端数据闭环

- 新建 GrantProject 等模型。
- 保存输入、关键词、候选题、报告、申请书。
- 接入额度扣减。

### P3：AI 和文献能力

- 接入关键词生成。
- 接入文献检索。
- 接入候选题生成。
- 接入报告和申请书流式生成。

### P4：高级能力

- Word 导出。
- 版本对比。
- 局部改写。
- 引用校验。
- Mermaid 校验。

## 10. 对当前原型的评价

当前原型的价值：

- 正确表达了“五步五页”的信息架构。
- 已经能通过顶部步骤在页面间切换。
- 能让团队快速理解模块入口和页面关系。

当前原型的不足：

- 内容密度不足，不像真实申报工作台。
- 没体现文献检索和证据链。
- 没体现长任务生成状态。
- 报告和申请书页面过于简化。
- 缺少版本、编辑、引用、导出这些申报场景关键能力。

下一步建议先迭代原型，而不是直接开发：

- 把五张页面从“结构图”升级为“高保真业务原型”。
- 先补选题关键词、基金选题、申请书三个页面。
- 再补报告正文和文献证据链。
