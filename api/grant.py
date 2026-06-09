from __future__ import annotations

import json
import io
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import docx
from docx.oxml.ns import qn
from docx.shared import Pt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
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
from services import ai_service, literature_service

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
    terms = _fallback_terms(project)
    variable = terms["variable"]
    disease = terms["disease"]
    phenotype = terms["phenotype"]
    variable_type = project.variable_type or "核心变量"
    subject_terms = [term for term in re.split(r"[\s,，;；、]+", project.subject or "") if term][:4]
    return {
        "must": [{"id": "must-variable", "text": variable, "source": "ai", "selected": True}],
        "should": [
            {"id": "or-disease", "text": disease, "source": "ai", "selected": True, "groupKey": "disease"},
            {"id": "or-phenotype", "text": phenotype, "source": "ai", "selected": True, "groupKey": "phenotype"},
            {"id": "or-type", "text": variable_type, "source": "ai", "selected": True, "groupKey": "target"},
            {"id": "or-variable", "text": variable, "source": "user", "selected": True, "groupKey": "target"},
            *[
                {"id": f"or-subject-{index}", "text": term, "source": "user", "selected": True, "groupKey": "subject"}
                for index, term in enumerate(subject_terms, 1)
            ],
            {"id": "or-mechanism", "text": "机制研究", "source": "system", "selected": True, "groupKey": "pathway"},
            {"id": "or-validation", "text": "功能验证", "source": "system", "selected": False, "groupKey": "technique"},
        ],
        "groups": [
            {"key": "disease", "label": "关联疾病", "keywords": [{"id": "g1", "text": disease, "source": "ai", "selected": True}, {"id": "g2", "text": f"{disease}模型", "source": "system", "selected": False}]},
            {"key": "phenotype", "label": "组织/细胞表型", "keywords": [{"id": "g3", "text": phenotype, "source": "ai", "selected": True}, {"id": "g4", "text": f"{phenotype}异质性", "source": "system", "selected": False}]},
            {"key": "target", "label": "分子靶点", "keywords": [{"id": "g5", "text": variable, "source": "ai", "selected": True}, {"id": "g6", "text": variable_type, "source": "ai", "selected": True}]},
            {"key": "subject", "label": "主题词", "keywords": [{"id": f"g-subject-{index}", "text": term, "source": "user", "selected": True} for index, term in enumerate(subject_terms, 1)]},
            {"key": "pathway", "label": "机制方向", "keywords": [{"id": "g7", "text": "机制研究", "source": "system", "selected": True}, {"id": "g8", "text": "信号通路", "source": "system", "selected": False}]},
            {"key": "technique", "label": "研究技术", "keywords": [{"id": "g9", "text": "公共数据分析", "source": "system", "selected": False}, {"id": "g10", "text": "体内外功能验证", "source": "system", "selected": False}]},
        ],
    }


def _fallback_terms(project: GrantProject) -> Dict[str, str]:
    disease_path = _json_loads(project.disease_path, []) or []
    disease = disease_path[-1] if disease_path else "目标疾病"
    phenotype = project.phenotype or "关键表型"
    variable = project.variable_name or project.variable_type or "核心变量"
    subject = project.subject or f"{variable}调控{phenotype}在{disease}中的作用机制"
    return {"disease": disease, "phenotype": phenotype, "variable": variable, "subject": subject}


def _mock_references(project: GrantProject) -> List[Dict[str, Any]]:
    terms = _fallback_terms(project)
    variable = terms["variable"]
    disease = terms["disease"]
    phenotype = terms["phenotype"]
    return [
        {"id": "ref-1", "pmid": "", "doi": "", "title": f"{variable} 与 {phenotype} 在 {disease} 研究中的机制线索", "journal": "待真实检索", "year": None, "evidenceNote": "未检索到可用真实文献时生成的占位线索，需重新检索或人工补充后再用于正式申请书。", "selectedForGeneration": False, "database": "fallback"},
        {"id": "ref-2", "pmid": "", "doi": "", "title": f"{disease} 中 {phenotype} 的研究进展与关键问题", "journal": "待真实检索", "year": None, "evidenceNote": "占位线索仅用于流程不中断，不作为真实参考文献。", "selectedForGeneration": False, "database": "fallback"},
        {"id": "ref-3", "pmid": "", "doi": "", "title": f"围绕 {variable} 构建 {disease} 机制研究假说", "journal": "待真实检索", "year": None, "evidenceNote": "占位线索仅提示后续检索方向，不进入正式引用。", "selectedForGeneration": False, "database": "fallback"},
    ]


def _mock_topics(project: GrantProject) -> List[Dict[str, Any]]:
    terms = _fallback_terms(project)
    variable = terms["variable"]
    disease = terms["disease"]
    phenotype = terms["phenotype"]
    titles = [
        ("topic-1", f"{variable}调控{phenotype}影响{disease}发生发展的机制研究", f"聚焦 {variable} 与 {phenotype} 的因果关系，解释其在 {disease} 进展中的关键作用。", True, [84, 82, 86, 70]),
        ("topic-2", f"{disease}中{variable}相关{phenotype}异质性及临床意义", f"从细胞或组织异质性切入，评估 {variable} 相关状态与临床分层之间的关系。", False, [81, 78, 82, 68]),
        ("topic-3", f"{variable}介导{phenotype}形成的上游调控网络研究", "强调上游调控因素与网络机制，适合进一步凝练关键科学问题。", False, [85, 73, 80, 64]),
        ("topic-4", f"靶向{variable}逆转{disease}中{phenotype}的实验研究", "面向机制干预和可验证实验路径，突出潜在转化价值。", False, [80, 76, 84, 66]),
        ("topic-5", f"{variable}信号轴在{disease}微环境重塑中的作用", "把研究对象放入疾病微环境，关注细胞互作和局部状态改变。", False, [82, 74, 79, 65]),
        ("topic-6", f"{phenotype}驱动{disease}治疗反应差异的机制研究", "围绕治疗响应差异设计，适合与临床样本或队列数据结合。", False, [78, 77, 81, 67]),
        ("topic-7", f"{variable}与关键通路协同调控{phenotype}的机制", "加入协同通路或共变量，形成更完整但仍可收敛的机制框架。", False, [83, 70, 76, 62]),
        ("topic-8", f"基于多组学解析{disease}中{variable}相关{phenotype}", "适合已有测序或组学基础的团队，强调数据驱动发现。", False, [79, 69, 75, 63]),
        ("topic-9", f"{variable}影响{disease}进展的时空动态机制", "关注病程阶段和空间定位差异，适合构建动态机制模型。", False, [82, 68, 74, 61]),
        ("topic-10", f"围绕{variable}构建{disease}风险评估与机制验证体系", "结合风险评估与机制验证，偏应用转化但需要注意基金属性匹配。", False, [75, 72, 70, 60]),
    ]
    return [
        {
            "id": id_,
            "title": title,
            "description": description,
            "innovation": f"围绕 {variable}、{phenotype} 与 {disease} 的关键机制形成聚焦问题。",
            "feasibility": "可通过临床样本、公共数据、体内外模型和机制干预实验组合验证。",
            "fundFit": "问题相对聚焦，适合进一步收敛为青年基金或面上项目申请方向。",
            "risk": "需要避免变量过多并明确关键机制节点。",
            "score": {"innovation": score[0], "feasibility": score[1], "fundFit": score[2], "evidence": score[3]},
            "referenceIds": ["ref-1", "ref-2"],
            "selected": selected,
        }
        for id_, title, description, selected, score in titles
    ]


def _mock_report_sections(project: GrantProject) -> List[Dict[str, Any]]:
    terms = _fallback_terms(project)
    subject = terms["subject"]
    variable = terms["variable"]
    disease = terms["disease"]
    phenotype = terms["phenotype"]
    return [
        {"key": "purpose", "title": "研究目的、意义", "markdown": f"本项目拟围绕“{subject}”开展研究，阐明 {variable} 与 {phenotype} 在 {disease} 中的作用关系，为后续机制验证和干预策略提供依据。"},
        {"key": "content", "title": "研究内容及实现方案", "markdown": f"研究将从 {phenotype} 特征识别、{variable} 作用机制解析和功能干预验证三个层面展开，结合临床样本、公共数据分析和体内外实验形成闭环。"},
        {"key": "hypothesis", "title": "科学问题和科学假说", "markdown": f"科学假说：{variable} 通过调控 {phenotype} 的形成或维持，影响 {disease} 的关键生物学过程；阻断或增强该环节可改变疾病相关表型。"},
        {"key": "evaluation", "title": "选题评估", "markdown": "该题目已根据用户输入动态收敛，但当前内容为 AI 不可用时的结构化兜底，需要结合真实文献和专家判断继续细化。"},
    ]


def _mock_proposal_sections(project: GrantProject) -> List[Dict[str, Any]]:
    terms = _fallback_terms(project)
    subject = terms["subject"]
    variable = terms["variable"]
    disease = terms["disease"]
    phenotype = terms["phenotype"]
    return [
        {"key": "abstract", "title": "中文摘要、关键词", "status": "needs_review", "wordCount": 260, "markdown": f"本项目拟围绕“{subject}”开展研究，重点分析 {variable} 与 {phenotype} 在 {disease} 中的关联及作用机制。当前为服务不可用时的结构化初稿，需要在真实 AI 生成或人工编辑后定稿。"},
        {"key": "attribute", "title": "科学问题属性选择理由", "status": "needs_review", "wordCount": 220, "markdown": f"本项目从 {disease} 相关现象出发，凝练 {variable} 调控 {phenotype} 的基础科学问题，适合进一步明确科学问题属性。"},
        {"key": "basis", "title": "项目立项依据", "status": "needs_review", "wordCount": 520, "markdown": f"{disease} 的发生发展涉及复杂调控网络，{phenotype} 是理解疾病机制的重要切入点。本项目以 {variable} 为核心变量，拟结合真实文献和预实验基础完善立项依据。"},
        {"key": "content", "title": "项目的研究内容", "status": "needs_review", "wordCount": 360, "markdown": f"研究内容一：描述 {disease} 中 {phenotype} 的变化特征。研究内容二：解析 {variable} 对该表型的调控作用。研究内容三：通过干预实验验证关键机制。"},
        {"key": "route", "title": "技术路线图", "status": "needs_review", "wordCount": 180, "markdown": "技术路线图章节待真实生成和语法校验，当前需在正式提交前人工复核。"},
        {"key": "plan", "title": "年度研究计划及预期结果", "status": "needs_review", "wordCount": 300, "markdown": "第一年完成数据和样本基础整理；第二年开展机制解析和关键节点验证；第三年完成干预实验、结果整合和申请书成果沉淀。"},
    ]


def _strip_json_fence(content: str) -> str:
    text = content.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


async def _try_ai_json(project: GrantProject, prompt: str, fallback: Any) -> Any:
    """Use the configured AI service only when it returns valid JSON.

    The platform often runs without a real API key in local/demo environments.
    In that case AIService returns a mock string, so we preserve deterministic
    fallback data to keep the grant workflow usable and testable.
    """
    response = await ai_service.chat_completion([{"role": "user", "content": prompt}], temperature=0.5)
    content = response.get("content", "")
    if not content or content.startswith("[Mock Response]") or content.startswith("AI 服务"):
        return fallback

    try:
        parsed = json.loads(_strip_json_fence(content))
    except Exception:
        return fallback

    return parsed


def _reference_search_query(project: GrantProject) -> str:
    keywords = _json_loads(project.keywords_json, {"must": [], "should": []})
    terms: List[str] = []

    for keyword in keywords.get("must", []):
        if keyword.get("selected", True) and keyword.get("text"):
            terms.append(str(keyword["text"]))

    for keyword in keywords.get("should", []):
        if keyword.get("selected", True) and keyword.get("text"):
            terms.append(str(keyword["text"]))

    for value in [
        project.subject,
        project.phenotype,
        project.variable_name,
        *(_json_loads(project.disease_path, []) or []),
    ]:
        if value:
            terms.append(str(value))

    deduped: List[str] = []
    seen = set()
    for term in terms:
        normalized = term.strip()
        if normalized and normalized.lower() not in seen:
            deduped.append(normalized)
            seen.add(normalized.lower())

    return " ".join(deduped[:8])


def _citation_year(value: Any) -> Optional[int]:
    if value is None:
        return None
    text = json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else str(value)
    match = re.search(r"\b(19|20)\d{2}\b", text)
    if match:
        return int(match.group(0))
    return None


def _citation_to_reference(citation: Dict[str, Any], index: int, query: str) -> Optional[Dict[str, Any]]:
    title = str(citation.get("title") or "").strip()
    if not title:
        return None

    link = citation.get("link") or ""
    pmid = citation.get("pmid") or citation.get("PMID") or citation.get("id") or ""
    if not pmid and "pubmed.ncbi.nlm.nih.gov/" in link:
        pmid = link.rstrip("/").split("/")[-1]

    journal = citation.get("source") or citation.get("journal") or citation.get("container-title") or ""
    if isinstance(journal, list):
        journal = journal[0] if journal else ""

    database = citation.get("database") or "学术数据库"
    year = _citation_year(citation.get("year") or citation.get("published") or citation.get("pubdate"))

    return {
        "id": f"ref-{index}",
        "pmid": str(pmid or ""),
        "doi": str(citation.get("doi") or citation.get("DOI") or ""),
        "title": title,
        "journal": str(journal or ""),
        "year": year,
        "evidenceNote": f"来自{database}，与检索式「{query}」相关，可用于支撑选题依据与研究背景。",
        "selectedForGeneration": index <= 5,
        "link": str(link or ""),
        "database": str(database),
        "formatted": str(citation.get("formatted") or ""),
    }


async def _search_real_references(project: GrantProject) -> List[Dict[str, Any]]:
    query = _reference_search_query(project)
    if not query:
        return []

    try:
        citations = await literature_service.search_literature(query, max_results=10)
    except Exception:
        return []

    references: List[Dict[str, Any]] = []
    seen_titles = set()
    for citation in citations:
        reference = _citation_to_reference(citation, len(references) + 1, query)
        if not reference:
            continue
        normalized_title = reference["title"].lower()
        if normalized_title in seen_titles:
            continue
        seen_titles.add(normalized_title)
        references.append(reference)

    return references


def _grant_context(project: GrantProject) -> str:
    return "\n".join([
        f"课题类型：{project.fund_type}",
        f"研究方向：{' / '.join(_json_loads(project.research_area_path, []))}",
        f"申请书主题：{project.subject or ''}",
        f"疾病：{' / '.join(_json_loads(project.disease_path, []))}",
        f"表型/科学问题：{project.phenotype or ''}",
        f"主变量：{project.variable_type or ''} / {project.variable_name or ''}",
    ])


def _add_docx_paragraph(document, text: str, style: Optional[str] = None):
    paragraph = document.add_paragraph(style=style)
    run = paragraph.add_run(text)
    run.font.name = "宋体"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "宋体")
    run.font.size = Pt(11)
    return paragraph


def _build_proposal_docx(project: GrantProject) -> io.BytesIO:
    document = docx.Document()
    styles = document.styles
    styles["Normal"].font.name = "宋体"
    styles["Normal"]._element.rPr.rFonts.set(qn("w:eastAsia"), "宋体")
    styles["Normal"].font.size = Pt(11)

    title = document.add_heading(project.title or "基金申请书", level=0)
    title.alignment = 1

    _add_docx_paragraph(document, f"项目类型：{project.fund_type or ''}")
    _add_docx_paragraph(document, f"研究方向：{' / '.join(_json_loads(project.research_area_path, []))}")
    _add_docx_paragraph(document, f"导出时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}")

    document.add_paragraph("")
    sections = _json_loads(project.proposal_sections_json, [])
    if not sections:
        _add_docx_paragraph(document, "暂无申请书正文，请先生成基金申请书。")
    for section in sections:
        document.add_heading(section.get("title", "未命名章节"), level=1)
        markdown = section.get("markdown", "")
        for paragraph in [line.strip() for line in markdown.split("\n") if line.strip()]:
            _add_docx_paragraph(document, paragraph)

    references = _json_loads(project.references_json, [])
    if references:
        document.add_heading("参考文献", level=1)
        for index, ref in enumerate(references, start=1):
            _add_docx_paragraph(
                document,
                f"{index}. {ref.get('title', '')}. {ref.get('journal', '')}, {ref.get('year', '')}. DOI: {ref.get('doi', '')}",
            )

    buffer = io.BytesIO()
    document.save(buffer)
    buffer.seek(0)
    return buffer


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
    title = f"{input_data.variable_name or input_data.variable_type or '核心变量'}相关{input_data.phenotype or '科学问题'}课题申报"
    if input_data.subject:
        title = input_data.subject.strip()

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
    fallback = _mock_keywords(project)
    prompt = f"""你是基金申报选题助手。请基于以下申报信息生成关键词结构，直接输出 JSON，不要输出 Markdown。

{_grant_context(project)}

JSON 格式：
{{
  "must": [{{"id": "must-1", "text": "必须包含关键词", "source": "ai", "selected": true}}],
  "should": [{{"id": "or-1", "text": "可选关键词", "source": "ai", "selected": true, "groupKey": "disease"}}],
  "groups": [{{"key": "disease", "label": "关联疾病", "keywords": [{{"id": "g1", "text": "关键词", "source": "ai", "selected": true}}]}}]
}}
"""
    keywords = await _try_ai_json(project, prompt, fallback)
    if not isinstance(keywords, dict) or not {"must", "should", "groups"}.issubset(keywords.keys()):
        keywords = fallback
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
    references = await _search_real_references(project)
    if not references:
        references = _mock_references(project)
    project.references_json = _json_dumps(references)
    project.status = "references_ready"
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
        project.references_json = _json_dumps(_mock_references(project))
    fallback = _mock_topics(project)
    prompt = f"""你是国家自然科学基金选题顾问。请基于申报信息、关键词和参考文献生成 10 个候选选题，直接输出 JSON 数组，不要输出 Markdown。

{_grant_context(project)}

关键词：
{project.keywords_json or ""}

参考文献：
{project.references_json or ""}

每个数组元素格式：
{{
  "id": "topic-1",
  "title": "题目",
  "description": "一句话说明",
  "innovation": "创新点",
  "feasibility": "可行性",
  "fundFit": "基金匹配度",
  "risk": "风险",
  "score": {{"innovation": 85, "feasibility": 80, "fundFit": 88, "evidence": 78}},
  "referenceIds": ["ref-1"],
  "selected": false
}}
"""
    topics = await _try_ai_json(project, prompt, fallback)
    if isinstance(topics, dict) and isinstance(topics.get("topics"), list):
        topics = topics["topics"]
    if not isinstance(topics, list) or not topics:
        topics = fallback
    if not any(topic.get("selected") for topic in topics if isinstance(topic, dict)):
        topics[0]["selected"] = True
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
    fallback = _mock_report_sections(project)
    prompt = f"""你是基金选题报告专家。请为已选题目生成选题报告章节，直接输出 JSON 数组，不要输出 Markdown。

{_grant_context(project)}

候选题：
{project.topics_json or ""}

参考文献：
{project.references_json or ""}

数组元素格式：
{{"key": "purpose", "title": "研究目的、意义", "markdown": "正文"}}
必须包含：研究目的、意义；研究内容及实现方案；科学问题和科学假说；选题评估。
"""
    sections = await _try_ai_json(project, prompt, fallback)
    if isinstance(sections, dict) and isinstance(sections.get("sections"), list):
        sections = sections["sections"]
    if not isinstance(sections, list) or not sections:
        sections = fallback
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
    fallback = _mock_proposal_sections(project)
    prompt = f"""你是国家自然科学基金申请书写作专家。请基于选题报告生成申请书初稿章节，直接输出 JSON 数组，不要输出 Markdown。

{_grant_context(project)}

选题报告：
{project.report_sections_json or ""}

数组元素格式：
{{"key": "abstract", "title": "中文摘要、关键词", "status": "ready", "wordCount": 500, "markdown": "正文"}}
必须包含中文摘要、科学问题属性选择理由、项目立项依据、研究内容、技术路线图、年度研究计划及预期结果。
"""
    sections = await _try_ai_json(project, prompt, fallback)
    if isinstance(sections, dict) and isinstance(sections.get("sections"), list):
        sections = sections["sections"]
    if not isinstance(sections, list) or not sections:
        sections = fallback
    project.proposal_sections_json = _json_dumps(sections)
    project.status = "proposal_ready"
    _save_step(db, project, "proposal", sections)
    db.commit()
    db.refresh(project)
    return _project_to_response(project)


@router.post("/projects/{project_id}/exports/word")
async def export_grant_proposal_word(
    project_id: int,
    item: GrantStepAction,
    db: Session = Depends(get_db),
    current_user: Optional[AdminUser] = Depends(get_optional_admin),
):
    project = await _get_project(db, project_id, item.token, current_user)
    buffer = _build_proposal_docx(project)
    filename = f"grant-proposal-{project_id}.docx"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers=headers,
    )
