from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.dependencies import verify_service_access
from database import get_db
from models import AdminUser, GrantProject, GrantStep
from schemas.grant import (
    GrantInputState,
    GrantKeywordPatch,
    GrantProjectCreate,
    GrantProjectResponse,
    GrantProjectSummary,
    GrantProjectUpdate,
    GrantStepAction,
    GrantTopicSelect,
)
from utils.auth import check_permission, get_optional_admin, verify_token

router = APIRouter(prefix="/api/ai/grant", tags=["grant"])


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _json_loads(value: Optional[str], default: Any):
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def _input_to_dict(item: GrantInputState) -> Dict[str, Any]:
    return {
        "fundType": item.fund_type,
        "researchAreaPath": item.research_area_path,
        "subject": item.subject or "",
        "diseasePath": item.disease_path or [],
        "phenotype": item.phenotype or "",
        "variableType": item.variable_type or "",
        "variableName": item.variable_name or "",
    }


def _project_input(project: GrantProject) -> Dict[str, Any]:
    return {
        "fundType": project.fund_type,
        "researchAreaPath": _json_loads(project.research_area_path, []),
        "subject": project.subject or "",
        "diseasePath": _json_loads(project.disease_path, []),
        "phenotype": project.phenotype or "",
        "variableType": project.variable_type or "",
        "variableName": project.variable_name or "",
    }


def _project_to_response(project: GrantProject) -> GrantProjectResponse:
    return GrantProjectResponse(
        id=project.id,
        title=project.title,
        status=project.status,
        current_step=project.current_step,
        input=_project_input(project),
        keywords=_json_loads(project.keywords_json, {"must": [], "should": [], "groups": []}),
        references=_json_loads(project.references_json, []),
        topics=_json_loads(project.topics_json, []),
        report_sections=_json_loads(project.report_sections_json, []),
        proposal_sections=_json_loads(project.proposal_sections_json, []),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def _project_to_summary(project: GrantProject) -> GrantProjectSummary:
    return GrantProjectSummary(
        id=project.id,
        title=project.title,
        status=project.status,
        current_step=project.current_step,
        fund_type=project.fund_type,
        research_area_path=_json_loads(project.research_area_path, []),
        updated_at=project.updated_at,
    )


async def _authorize_project_query(
    db: Session,
    token: Optional[str],
    current_user: Optional[AdminUser],
):
    if current_user:
        check_permission(current_user, "ai")
        query = db.query(GrantProject)
        if current_user.group and current_user.group.name != "SuperAdmin":
            query = query.filter(GrantProject.admin_id == current_user.id)
        return query, None

    if not token:
        raise HTTPException(status_code=401, detail="Access token required")
    token_record = verify_token(token, db, "ai")
    return db.query(GrantProject).filter(GrantProject.token_id == token_record.id), token_record


async def _get_project(
    db: Session,
    project_id: int,
    token: Optional[str],
    current_user: Optional[AdminUser],
) -> GrantProject:
    query, _ = await _authorize_project_query(db, token, current_user)
    project = query.filter(GrantProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Grant project not found")
    return project


def _save_step(db: Session, project: GrantProject, step_key: str, output: Any, status: str = "ready"):
    step = GrantStep(
        project_id=project.id,
        step_key=step_key,
        status=status,
        input_json=_json_dumps(_project_input(project)),
        output_json=_json_dumps(output),
    )
    db.add(step)
    project.current_step = step_key
    project.updated_at = datetime.now(timezone.utc)


def _mock_keywords(project: GrantProject) -> Dict[str, Any]:
    variable = project.variable_name or "PD-1"
    return {
        "must": [{"id": "must-pd1", "text": "PD-1", "source": "ai", "selected": True}],
        "should": [
            {"id": "or-melanoma-zh", "text": "黑色素瘤", "source": "ai", "selected": True, "groupKey": "disease"},
            {"id": "or-exhaustion", "text": "T细胞耗竭", "source": "ai", "selected": True, "groupKey": "phenotype"},
            {"id": "or-receptor", "text": project.variable_type or "膜受体", "source": "ai", "selected": True, "groupKey": "target"},
            {"id": "or-variable", "text": variable, "source": "user", "selected": True, "groupKey": "target"},
            {"id": "or-melanoma-en", "text": "Melanoma", "source": "ai", "selected": True, "groupKey": "disease"},
            {"id": "or-cd8", "text": "CD8+ T cell", "source": "ai", "selected": True, "groupKey": "phenotype"},
            {"id": "or-pathway", "text": "PD-1 signaling pathway", "source": "ai", "selected": True, "groupKey": "pathway"},
            {"id": "or-ici", "text": "Immune checkpoint inhibitor", "source": "ai", "selected": True, "groupKey": "therapy"},
        ],
        "groups": [
            {"key": "disease", "label": "关联疾病", "keywords": [{"id": "g1", "text": "黑色素瘤", "source": "ai", "selected": True}, {"id": "g2", "text": "Melanoma", "source": "ai", "selected": True}, {"id": "g3", "text": "转移性黑色素瘤", "source": "ai", "selected": False}]},
            {"key": "phenotype", "label": "组织/细胞表型", "keywords": [{"id": "g4", "text": "T细胞耗竭", "source": "ai", "selected": True}, {"id": "g5", "text": "CD8+ T cell", "source": "ai", "selected": True}, {"id": "g6", "text": "肿瘤浸润淋巴细胞", "source": "ai", "selected": False}]},
            {"key": "target", "label": "分子靶点", "keywords": [{"id": "g7", "text": "PD-1", "source": "ai", "selected": True}, {"id": "g8", "text": "PDCD1", "source": "ai", "selected": False}, {"id": "g9", "text": "Tim-3", "source": "ai", "selected": False}]},
            {"key": "pathway", "label": "信号通路", "keywords": [{"id": "g10", "text": "PD-1 signaling pathway", "source": "ai", "selected": True}, {"id": "g11", "text": "TCR signaling", "source": "ai", "selected": False}, {"id": "g12", "text": "线粒体动力学", "source": "ai", "selected": False}]},
            {"key": "therapy", "label": "治疗方法", "keywords": [{"id": "g13", "text": "Immune checkpoint inhibitor", "source": "ai", "selected": True}, {"id": "g14", "text": "PD-1阻断", "source": "ai", "selected": False}, {"id": "g15", "text": "联合免疫治疗", "source": "ai", "selected": False}]},
            {"key": "technique", "label": "研究技术", "keywords": [{"id": "g16", "text": "单细胞测序", "source": "ai", "selected": False}, {"id": "g17", "text": "流式细胞术", "source": "ai", "selected": False}, {"id": "g18", "text": "空间转录组", "source": "ai", "selected": False}]},
        ],
    }


def _mock_references() -> List[Dict[str, Any]]:
    return [
        {"id": "ref-1", "pmid": "37200001", "doi": "10.1016/j.cell.2023.immune.001", "title": "PD-1 signaling remodels exhausted CD8+ T cells in melanoma microenvironment", "journal": "Cell", "year": 2023, "evidenceNote": "支持 PD-1 信号与 CD8+ T 细胞耗竭的机制关联。", "selectedForGeneration": True},
        {"id": "ref-2", "pmid": "36880002", "doi": "10.1038/s41590-023-immune", "title": "Heterogeneity of PD-1hi tumor-infiltrating CD8 T cells predicts checkpoint response", "journal": "Nature Immunology", "year": 2023, "evidenceNote": "支持 PD-1hi CD8+ T 细胞亚群与免疫治疗疗效相关。", "selectedForGeneration": True},
        {"id": "ref-3", "pmid": "35510003", "doi": "10.1158/0008-5472.can-22-immune", "title": "T cell exhaustion and resistance to immune checkpoint blockade in melanoma", "journal": "Cancer Research", "year": 2022, "evidenceNote": "支持黑色素瘤免疫治疗耐药与 T 细胞耗竭之间的关系。", "selectedForGeneration": True},
    ]


def _mock_topics() -> List[Dict[str, Any]]:
    titles = [
        ("topic-1", "PD-1介导的CD8+ T细胞耗竭与黑色素瘤免疫治疗耐药机制", "聚焦PD-1信号通路如何驱动黑色素瘤微环境中CD8+ T细胞功能耗竭，探究其对免疫检查点抑制剂疗效的影响及潜在逆转策略。", True, [88, 84, 91, 86]),
        ("topic-2", "黑色素瘤中PD-1与Tim-3共表达调控CD8+ T细胞耗竭的分子机制", "强调共抑制受体协同调控，适合走免疫逃逸和细胞状态转换方向。", False, [83, 76, 80, 78]),
        ("topic-3", "Rab37介导的PD-1膜定位在黑色素瘤T细胞耗竭中的作用", "切入膜定位和小 GTP 酶调控，创新性较强但实验路径要求更高。", False, [91, 68, 73, 62]),
        ("topic-4", "PD-1信号通路通过Drp1调控线粒体动力学影响CD8+ T细胞耗竭", "连接免疫检查点和代谢/线粒体动力学，可作为机制深化备选。", False, [86, 72, 78, 70]),
        ("topic-5", "PD-1hi CD8+ T细胞亚群在黑色素瘤中的异质性及其临床意义", "聚焦 PD-1 高表达细胞群异质性和临床关联。", False, [78, 74, 70, 82]),
        ("topic-6", "PD-1阻断后肿瘤引流淋巴结中CD8+ T细胞功能重塑的机制", "把研究范围前移到肿瘤引流淋巴结，关注免疫治疗后 T 细胞功能重塑。", False, [82, 70, 76, 74]),
        ("topic-7", "PD-1与LAG-3协同调控CD8+ T细胞耗竭在黑色素瘤中的免疫逃逸机制", "围绕双检查点协同调控和免疫逃逸展开，适合延伸联合免疫治疗方向。", False, [84, 71, 78, 76]),
        ("topic-8", "STAT5调控PD-1转录活性影响CD8+ T细胞耗竭敏感性的机制", "从转录调控层面解释 PD-1 表达维持和耗竭易感性。", False, [87, 73, 80, 66]),
        ("topic-9", "PD-1信号通路在肿瘤抗原特异性CD8+ T细胞功能衰竭中的作用", "聚焦肿瘤抗原特异性 T 细胞，更强调抗原识别和效应功能下降。", False, [80, 69, 72, 68]),
        ("topic-10", "PD-1介导的CD8+ T细胞耗竭影响免疫检查点抑制剂安全性的机制", "从疗效之外关注安全性和免疫相关不良反应，形成差异化选题。", False, [76, 64, 68, 60]),
    ]
    return [
        {
            "id": id_,
            "title": title,
            "description": description,
            "innovation": "围绕免疫治疗耐药中的关键机制形成聚焦问题。",
            "feasibility": "可通过临床样本、流式检测和体外功能实验组合验证。",
            "fundFit": "问题相对聚焦，适合青年基金进一步收敛。",
            "risk": "需要避免变量过多并明确关键机制节点。",
            "score": {"innovation": score[0], "feasibility": score[1], "fundFit": score[2], "evidence": score[3]},
            "referenceIds": ["ref-1", "ref-2"],
            "selected": selected,
        }
        for id_, title, description, selected, score in titles
    ]


def _mock_report_sections() -> List[Dict[str, Any]]:
    return [
        {"key": "purpose", "title": "研究目的、意义", "markdown": "本项目拟阐明 PD-1 信号介导 CD8+ T 细胞耗竭并导致黑色素瘤免疫治疗耐药的关键机制，为提高免疫检查点抑制剂疗效提供理论依据。"},
        {"key": "content", "title": "研究内容及实现方案", "markdown": "围绕 PD-1 高表达 CD8+ T 细胞功能状态、下游信号变化和治疗反应差异三个层面展开，结合临床样本、细胞功能实验和机制干预验证。"},
        {"key": "hypothesis", "title": "科学问题和科学假说", "markdown": "科学假说：PD-1 持续激活通过重塑 CD8+ T 细胞效应功能和代谢状态，推动耗竭表型稳定化，从而降低黑色素瘤对免疫检查点抑制剂的响应。"},
        {"key": "evaluation", "title": "选题评估", "markdown": "该题目问题聚焦、机制路径清晰、文献基础较充分，适合青年基金。但需要在申请书中控制研究范围，聚焦 1-2 个关键机制节点。"},
    ]


def _mock_proposal_sections() -> List[Dict[str, Any]]:
    return [
        {"key": "abstract", "title": "中文摘要、关键词", "status": "ready", "wordCount": 420, "markdown": "黑色素瘤免疫治疗耐药是限制免疫检查点抑制剂疗效的关键问题。本项目拟围绕 PD-1 介导的 CD8+ T 细胞耗竭机制展开研究，解析其在耐药形成中的作用。"},
        {"key": "attribute", "title": "科学问题属性选择理由", "status": "ready", "wordCount": 360, "markdown": "本项目聚焦免疫治疗耐药中的基础机制问题，属于从疾病现象凝练关键科学问题并开展机制研究的类型。"},
        {"key": "basis", "title": "项目立项依据", "status": "ready", "wordCount": 1680, "markdown": "免疫检查点抑制剂显著改善了黑色素瘤治疗格局，但仍有相当比例患者应答不足或发生继发耐药。CD8+ T 细胞耗竭被认为是影响抗肿瘤免疫效应的重要因素。"},
        {"key": "content", "title": "项目的研究内容", "status": "ready", "wordCount": 980, "markdown": "研究内容一：明确黑色素瘤中 PD-1 高表达 CD8+ T 细胞的耗竭特征。研究内容二：解析 PD-1 信号维持耗竭状态的关键分子机制。"},
        {"key": "route", "title": "技术路线图", "status": "needs_review", "wordCount": 240, "markdown": "Mermaid 图示待校验。若渲染失败，应展示源码并允许重新生成图示。"},
        {"key": "plan", "title": "年度研究计划及预期结果", "status": "ready", "wordCount": 620, "markdown": "第一年完成样本和模型建立；第二年解析关键机制节点；第三年完成干预验证和申请书成果总结。"},
    ]


@router.post("/projects", response_model=GrantProjectResponse)
async def create_grant_project(
    item: GrantProjectCreate,
    db: Session = Depends(get_db),
    current_user: Optional[AdminUser] = Depends(get_optional_admin),
):
    token_record = None
    if current_user:
        check_permission(current_user, "ai")
    else:
        token_record = await verify_service_access(db, item.token, "ai")

    input_data = item.input
    title = f"{input_data.variable_name or 'PD-1'}相关{input_data.phenotype or '科学问题'}课题申报"
    if input_data.subject:
        title = "PD-1介导的CD8+ T细胞耗竭与黑色素瘤免疫治疗耐药机制"

    project = GrantProject(
        token_id=token_record.id if token_record else None,
        admin_id=current_user.id if current_user else None,
        title=title,
        status="draft",
        current_step="input",
        fund_type=input_data.fund_type,
        research_area_path=_json_dumps(input_data.research_area_path),
        subject=input_data.subject,
        disease_path=_json_dumps(input_data.disease_path),
        phenotype=input_data.phenotype,
        variable_type=input_data.variable_type,
        variable_name=input_data.variable_name,
        keywords_json=_json_dumps({"must": [], "should": [], "groups": []}),
        references_json=_json_dumps([]),
        topics_json=_json_dumps([]),
        report_sections_json=_json_dumps([]),
        proposal_sections_json=_json_dumps([]),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_to_response(project)


@router.get("/projects", response_model=List[GrantProjectSummary])
async def list_grant_projects(
    token: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[AdminUser] = Depends(get_optional_admin),
):
    query, _ = await _authorize_project_query(db, token, current_user)
    projects = query.order_by(GrantProject.updated_at.desc()).all()
    return [_project_to_summary(project) for project in projects]


@router.get("/projects/{project_id}", response_model=GrantProjectResponse)
async def get_grant_project(
    project_id: int,
    token: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[AdminUser] = Depends(get_optional_admin),
):
    project = await _get_project(db, project_id, token, current_user)
    return _project_to_response(project)


@router.patch("/projects/{project_id}", response_model=GrantProjectResponse)
async def update_grant_project(
    project_id: int,
    item: GrantProjectUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[AdminUser] = Depends(get_optional_admin),
):
    project = await _get_project(db, project_id, item.token, current_user)
    if item.title is not None:
        project.title = item.title
    if item.current_step is not None:
        project.current_step = item.current_step
    if item.status is not None:
        project.status = item.status
    if item.input is not None:
        input_data = item.input
        project.fund_type = input_data.fund_type
        project.research_area_path = _json_dumps(input_data.research_area_path)
        project.subject = input_data.subject
        project.disease_path = _json_dumps(input_data.disease_path)
        project.phenotype = input_data.phenotype
        project.variable_type = input_data.variable_type
        project.variable_name = input_data.variable_name
    project.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(project)
    return _project_to_response(project)


@router.post("/projects/{project_id}/keywords/generate", response_model=GrantProjectResponse)
async def generate_keywords(
    project_id: int,
    item: GrantStepAction,
    db: Session = Depends(get_db),
    current_user: Optional[AdminUser] = Depends(get_optional_admin),
):
    project = await _get_project(db, project_id, item.token, current_user)
    keywords = _mock_keywords(project)
    project.keywords_json = _json_dumps(keywords)
    project.status = "keywords_ready"
    _save_step(db, project, "keywords", keywords)
    db.commit()
    db.refresh(project)
    return _project_to_response(project)


@router.patch("/projects/{project_id}/keywords", response_model=GrantProjectResponse)
async def update_keywords(
    project_id: int,
    item: GrantKeywordPatch,
    db: Session = Depends(get_db),
    current_user: Optional[AdminUser] = Depends(get_optional_admin),
):
    project = await _get_project(db, project_id, item.token, current_user)
    project.keywords_json = _json_dumps(item.keywords)
    project.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(project)
    return _project_to_response(project)


@router.post("/projects/{project_id}/references/search", response_model=GrantProjectResponse)
async def search_references(
    project_id: int,
    item: GrantStepAction,
    db: Session = Depends(get_db),
    current_user: Optional[AdminUser] = Depends(get_optional_admin),
):
    project = await _get_project(db, project_id, item.token, current_user)
    references = _mock_references()
    project.references_json = _json_dumps(references)
    _save_step(db, project, "references", references)
    db.commit()
    db.refresh(project)
    return _project_to_response(project)


@router.post("/projects/{project_id}/topics/generate", response_model=GrantProjectResponse)
async def generate_topics(
    project_id: int,
    item: GrantStepAction,
    db: Session = Depends(get_db),
    current_user: Optional[AdminUser] = Depends(get_optional_admin),
):
    project = await _get_project(db, project_id, item.token, current_user)
    if not project.references_json or project.references_json == "[]":
        project.references_json = _json_dumps(_mock_references())
    topics = _mock_topics()
    project.topics_json = _json_dumps(topics)
    project.status = "topics_ready"
    project.title = topics[0]["title"]
    _save_step(db, project, "topics", topics)
    db.commit()
    db.refresh(project)
    return _project_to_response(project)


@router.post("/projects/{project_id}/topics/{topic_id}/select", response_model=GrantProjectResponse)
async def select_topic(
    project_id: int,
    topic_id: str,
    item: GrantTopicSelect,
    db: Session = Depends(get_db),
    current_user: Optional[AdminUser] = Depends(get_optional_admin),
):
    project = await _get_project(db, project_id, item.token, current_user)
    topics = _json_loads(project.topics_json, [])
    found = False
    for topic in topics:
        topic["selected"] = topic.get("id") == topic_id
        if topic["selected"]:
            project.title = topic.get("title", project.title)
            found = True
    if not found:
        raise HTTPException(status_code=404, detail="Topic not found")
    project.topics_json = _json_dumps(topics)
    project.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(project)
    return _project_to_response(project)


@router.post("/projects/{project_id}/report/generate", response_model=GrantProjectResponse)
async def generate_report(
    project_id: int,
    item: GrantStepAction,
    db: Session = Depends(get_db),
    current_user: Optional[AdminUser] = Depends(get_optional_admin),
):
    project = await _get_project(db, project_id, item.token, current_user)
    sections = _mock_report_sections()
    project.report_sections_json = _json_dumps(sections)
    project.status = "report_ready"
    _save_step(db, project, "report", sections)
    db.commit()
    db.refresh(project)
    return _project_to_response(project)


@router.post("/projects/{project_id}/proposal/generate", response_model=GrantProjectResponse)
async def generate_proposal(
    project_id: int,
    item: GrantStepAction,
    db: Session = Depends(get_db),
    current_user: Optional[AdminUser] = Depends(get_optional_admin),
):
    project = await _get_project(db, project_id, item.token, current_user)
    sections = _mock_proposal_sections()
    project.proposal_sections_json = _json_dumps(sections)
    project.status = "proposal_ready"
    _save_step(db, project, "proposal", sections)
    db.commit()
    db.refresh(project)
    return _project_to_response(project)
