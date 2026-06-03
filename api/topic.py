from __future__ import annotations

import json
import re
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from schemas.topic import (
    TopicGenerationRequest,
    TopicAnalysisRequest,
    TopicRefineRequest,
)
from utils.auth import get_optional_admin, check_permission
from database import get_db
from models import AdminUser, ThesisProject, ThesisStep
from api.dependencies import verify_service_access, deduct_token_quota
from services import ai_service, literature_service
from services.generation_logger import log_generation

router = APIRouter(prefix="/api/ai/topic", tags=["topics"])


@router.post("/generate")
async def generate_research_topics(req: TopicGenerationRequest, db: Session = Depends(get_db), current_user: Optional[AdminUser] = Depends(get_optional_admin)):
    """Generate research topic suggestions based on user input."""
    token_record = None
    if not current_user:
        token_record = await verify_service_access(db, req.token, "ai")
    else:
        check_permission(current_user, "ai")

    try:
        # Call AI service to generate topics
        t0 = time.time()
        result_dict = await ai_service.generate_research_topics(
            discipline=req.discipline,
            research_direction=req.research_direction or "",
            keywords=req.keywords or [],
            count=req.count
        )
        duration_ms = int((time.time() - t0) * 1000)

        # Parse JSON result from the content field
        result = result_dict.get("content", "")

        # Try to extract JSON from the response
        json_start = result.find('```json')
        json_end = result.rfind('```')
        if json_start != -1 and json_end != -1:
            json_str = result[json_start+7:json_end].strip()
        else:
            json_str = result

        topics_data = json.loads(json_str)

        # Log generation
        log_generation(
            db, mode="topic_generate",
            token_id=token_record.id if token_record else None,
            input_text=f"{req.discipline} | {req.research_direction or ''} | {', '.join(req.keywords or [])}",
            model_response=result, output_content=result,
            model=ai_service.model,
            prompt_tokens=result_dict.get("prompt_tokens", 0),
            completion_tokens=result_dict.get("completion_tokens", 0),
            total_tokens=result_dict.get("total_tokens", 0),
            duration_ms=duration_ms, status="success",
        )

        return {
            "topics": topics_data.get("topics", []),
            "discipline": req.discipline,
            "generated_count": len(topics_data.get("topics", []))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate topics: {str(e)}")


@router.post("/analyze")
async def analyze_research_topic(req: TopicAnalysisRequest, db: Session = Depends(get_db), current_user: Optional[AdminUser] = Depends(get_optional_admin)):
    """Analyze a research topic in depth."""
    token_record = None
    if not current_user:
        token_record = await verify_service_access(db, req.token, "ai")
    else:
        check_permission(current_user, "ai")

    try:
        # Call AI service to analyze topic
        t0 = time.time()
        result_dict = await ai_service.analyze_topic(
            topic=req.topic,
            discipline=req.discipline
        )
        duration_ms = int((time.time() - t0) * 1000)

        # Parse JSON result from the content field
        result = result_dict.get("content", "")

        # Try to extract JSON from the response
        json_start = result.find('```json')
        json_end = result.rfind('```')
        if json_start != -1 and json_end != -1:
            json_str = result[json_start+7:json_end].strip()
        else:
            json_str = result

        analysis_data = json.loads(json_str)

        # Fetch real literature for recommended references
        real_citations = await literature_service.search_literature(req.topic, max_results=5)

        # Log generation
        log_generation(
            db, mode="topic_analyze",
            token_id=token_record.id if token_record else None,
            input_text=req.topic,
            search_results=real_citations,
            model_response=result, output_content=result,
            model=ai_service.model,
            prompt_tokens=result_dict.get("prompt_tokens", 0),
            completion_tokens=result_dict.get("completion_tokens", 0),
            total_tokens=result_dict.get("total_tokens", 0),
            duration_ms=duration_ms, status="success",
        )

        return {
            "topic": req.topic,
            "discipline": req.discipline,
            "similar_papers": analysis_data.get("similar_papers", []),
            "overall_similarity": analysis_data.get("overall_similarity", 0),
            "analysis": analysis_data.get("analysis", {}),
            "research_background": analysis_data.get("research_background", ""),
            "research_significance": analysis_data.get("research_significance", ""),
            "feasibility_analysis": analysis_data.get("feasibility_analysis", ""),
            "potential_innovations": analysis_data.get("potential_innovations", []),
            "extended_directions": analysis_data.get("extended_directions", []),
            "recommended_references": analysis_data.get("recommended_references", []),
            "real_literature": real_citations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze topic: {str(e)}")


@router.post("/refine")
async def refine_research_topic(req: TopicRefineRequest, db: Session = Depends(get_db), current_user: Optional[AdminUser] = Depends(get_optional_admin)):
    """Refine a research topic based on user feedback."""
    token_record = None
    if not current_user:
        token_record = await verify_service_access(db, req.token, "ai")
    else:
        check_permission(current_user, "ai")

    try:
        result_dict = await ai_service.refine_topic(
            topic=req.topic,
            discipline=req.discipline,
            requirements=req.requirements
        )

        # Parse JSON result from the content field
        result = result_dict.get("content", "")

        json_start = result.find('```json')
        json_end = result.rfind('```')
        if json_start != -1 and json_end != -1:
            json_str = result[json_start+7:json_end].strip()
        else:
            json_str = result

        new_topic = json.loads(json_str)
        return new_topic
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refine topic: {str(e)}")


@router.post("/create-and-outline")
async def create_thesis_from_topic_and_generate_outline(req: dict = Body(...), db: Session = Depends(get_db), current_user: Optional[AdminUser] = Depends(get_optional_admin)):
    """从选题直接创建项目并生成提纲（一体化流程）"""
    # Use Body(dict) to bypass Pydantic validation for now to see what's being sent
    topic_title = req.get("topic_title")
    discipline = req.get("discipline")
    description = req.get("description", "")
    language = req.get("language", "zh")
    length = req.get("length", "Standard (5000 words)")
    style = req.get("style", "Academic")
    thesis_type = req.get("thesis_type", "Original Research")
    token = req.get("token")
    references = req.get("references", [])
    style_example = req.get("style_example")

    if not topic_title or not discipline:
        raise HTTPException(status_code=422, detail="Missing required fields: topic_title or discipline")

    token_record = None
    if not current_user:
        token_record = await verify_service_access(db, token, "ai")
    else:
        check_permission(current_user, "ai")

    # Create project from topic
    project = ThesisProject(
        token_id=token_record.id if token_record else None,
        admin_id=current_user.id if current_user else None,
        title=topic_title,
        topic=topic_title,
        discipline=discipline,
        language=language,
        length=length,
        style=style,
        thesis_type=thesis_type,
        reference_files=json.dumps(references, ensure_ascii=False) if references else None,
        style_example_file=json.dumps(style_example, ensure_ascii=False) if style_example else None
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Auto generate outline
    try:
        # Build reference context
        user_ref_context = ""
        user_ref_bibliography = ""
        if references:
            user_ref_context = "\n【用户指定必读参考文献（已验证真实性或强制使用）】\n"
            user_ref_bibliography = "\n【必须在提纲的参考文献部分完整列出的文献】\n"
            for i, ref in enumerate(references, 1):
                authors_str = ", ".join(ref.get("authors", [])[:3])
                if len(ref.get("authors", [])) > 3:
                    authors_str += " et al."
                ref_line = f"{i}. {authors_str} ({ref.get('year', 'n.d.')}). {ref.get('title', '')}. {ref.get('source', '')}"
                if ref.get("doi"):
                    ref_line += f". https://doi.org/{ref['doi']}"
                user_ref_context += f"  - {ref_line}\n"
                user_ref_bibliography += f"{ref_line}\n"
            user_ref_context += f"\n注意：请在提纲中考虑引用这些文献，并在后续全文生成时务必在正文中引用。提纲的参考文献部分必须完整列出以上 {len(references)} 篇文献，一篇都不能遗漏。\n"

        style_example_context = ""
        if style_example:
            style_example_context = f"\n【学术范例文献】标题：{style_example.get('title', '')}\n请适当参照该范例的行文风格和论述方式。\n"

        # Fetch real literature
        real_citations = await literature_service.search_literature(topic_title, max_results=15)
        lit_context = ""
        if real_citations:
            lit_context = "以下是从真实学术数据库中检索到的相关文献（可直接引用）：\n" + "\n".join([f"- {cit.get('formatted', str(cit))}" for cit in real_citations])
        prompt = f"""你是一位资深的学术导师。请为以下论著选题生成一份详细的提纲：

【选题信息】
题目：{topic_title}
学科：{discipline}
{f"描述：{description}" if description else ""}
语言：{'中文' if language == 'zh' else '英文'}
篇幅：{length}

{lit_context if lit_context else ""}
{user_ref_context if user_ref_context else ""}
{style_example_context if style_example_context else ""}
{user_ref_bibliography if user_ref_bibliography else ""}

【输出要求】
1. 必须使用标准 Markdown 标题语法（# 代表一级章节，## 代表二级章节）。
2. 请按以下结构输出，每个部分必须以 # 开头：
   # 标题
   （在此处输出论文题目）

   # 摘要要点
   （包含问题陈述、核心方法、主要贡献、实验结果等）

   # 引言
   ## 研究背景
   ## 研究问题
   ## 研究意义

   # 核心章节（根据学科需要生成 3-5 个核心章节，使用 ## 作为小节标题）

   # 结论

   # 参考文献
    （必须同时包含上方提供的【真实检索文献】和【用户指定文献】两部分，按编号连续排列，用户指定文献一篇都不能遗漏）

3. 公式必须使用 LaTeX 格式，块级公式使用 `$$ ... $$`，行内公式使用 `$ ... $`。
4. 直接输出提纲内容，严禁任何开场白或解释性文字。"""

        t0 = time.time()
        ai_response = await ai_service.chat_completion([{"role": "user", "content": prompt}], temperature=0.7)
        duration_ms = int((time.time() - t0) * 1000)
        outline = ai_response["content"]

        # --- 后处理：确保提纲的参考文献章节包含所有真实检索文献和用户文献 ---
        all_refs = []
        if real_citations:
            for cit in real_citations:
                formatted = cit.get('formatted')
                if formatted:
                    all_refs.append(formatted)
                else:
                    authors_str = ", ".join(cit.get("authors", [])[:3])
                    if len(cit.get("authors", [])) > 3:
                        authors_str += " et al."
                    year = cit.get("year", "n.d.")
                    title = cit.get("title", "")
                    source = cit.get("source", "")
                    ref_line = f"{authors_str} ({year}). {title}. {source}"
                    if cit.get("doi"):
                        ref_line += f". https://doi.org/{cit['doi']}"
                    all_refs.append(ref_line)
        if references:
            for ref in references:
                authors_str = ", ".join(ref.get("authors", [])[:3])
                if len(ref.get("authors", [])) > 3:
                    authors_str += " et al."
                ref_line = f"{authors_str} ({ref.get('year', 'n.d.')}). {ref.get('title', '')}. {ref.get('source', '')}"
                if ref.get("doi"):
                    ref_line += f". https://doi.org/{ref['doi']}"
                all_refs.append(ref_line)

        if all_refs:
            # 查找参考文献章节
            ref_pattern = re.compile(
                r'^(#{1,3}\s*\d*[\.\s]*(?:参考文献|References|REF)\s*)$',
                re.IGNORECASE | re.MULTILINE
            )
            ref_match = ref_pattern.search(outline)
            if ref_match:
                ref_section_start = ref_match.end()
                next_heading = re.search(r'\n#{1,3}\s', outline[ref_section_start:])
                ref_section_end = ref_section_start + next_heading.start() if next_heading else len(outline)

                # 检查是否已有参考文献条目
                ref_section_content = outline[ref_section_start:ref_section_end]
                existing_count = len(re.findall(r'^\d+\.\s', ref_section_content, re.MULTILINE))

                # 如果已有文献数量少于应提供的数量，追加缺失的
                if existing_count < len(all_refs):
                    missing_refs = all_refs[existing_count:]
                    next_num = existing_count + 1
                    missing_block = "\n".join([f"{next_num + i}. {ref}" for i, ref in enumerate(missing_refs)])
                    insert_text = "\n" + missing_block + "\n"
                    outline = outline[:ref_section_end] + insert_text + outline[ref_section_end:]
            else:
                # 没有参考文献章节，在文末追加
                ref_block = "\n\n# 参考文献\n" + "\n".join([f"{i+1}. {ref}" for i, ref in enumerate(all_refs)]) + "\n"
                outline += ref_block

        # Deduct token quota if using service token
        if token_record and ai_response.get("total_tokens", 0) > 0:
            deduct_token_quota(db, token_record.id, ai_response["total_tokens"])

        # Log generation
        log_generation(
            db, mode="topic_create_and_outline",
            token_id=token_record.id if token_record else None,
            project_id=project.id,
            input_text=topic_title,
            search_results=real_citations,
            final_prompt=prompt, model_response=outline,
            output_content=outline,
            model=ai_service.model,
            prompt_tokens=ai_response.get("prompt_tokens", 0),
            completion_tokens=ai_response.get("completion_tokens", 0),
            total_tokens=ai_response.get("total_tokens", 0),
            duration_ms=duration_ms, status="success",
        )

        # Save outline
        step = ThesisStep(project_id=project.id, step_num=1, content=outline)
        db.add(step)
        project.current_step = 1
        db.commit()

        return {
            "project": {
                "id": project.id,
                "title": project.title,
                "topic": project.topic
            },
            "outline": outline,
            "citations": real_citations,
            "message": "项目已创建并生成提纲"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate outline: {str(e)}")
