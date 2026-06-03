from __future__ import annotations

import json
import re
import time
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from schemas.ai import AIRequest
from utils.auth import get_optional_admin, check_permission
from database import get_db
from models import AdminUser
from api.dependencies import verify_service_access, deduct_token_quota
from services import ai_service
from services.generation_logger import log_generation

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/process")
async def process_text(request: AIRequest, db: Session = Depends(get_db), current_user: Optional[AdminUser] = Depends(get_optional_admin)):
    # Check if user has permission (allows None for 'ai' if token is present)
    token_record = None
    if not current_user:
        token_record = await verify_service_access(db, request.token, "ai")
    else:
        check_permission(current_user, "ai")

    # Build dynamic prompts based on mode and tool-specific options
    intensity = request.intensity or 'standard'
    style_map = {'academic': '通用学术规范', 'journal': '国际期刊发表标准', 'thesis': '学位论文写作规范'}
    intensity_map_polish = {
        'conservative': '保守模式：仅做最小必要修改，纠正明显的语法和用词问题，保持原文表达方式',
        'standard': '标准模式：优化遣词造句，提升表达流畅度，适度调整句式结构',
        'deep': '深度模式：全面优化文本，包括词汇升级、句式重构、逻辑衔接强化，使语言达到顶级期刊水平'
    }
    style_desc = style_map.get(request.style or 'academic', '通用学术规范')

    # Precompute all f-string values (can't use dict.get() inside f-strings)
    translate_dir_map = {
        'auto': '自动识别源语言并翻译为目标语言（中文↔英文）',
        'zh2en': '中文翻译为英文',
        'en2zh': '英文翻译为中文'
    }
    translate_dir_desc = translate_dir_map.get(request.direction or 'auto', '自动识别')

    grammar_level_map = {
        'basic': '基础检查：仅纠正语法错误、拼写错误和标点错误',
        'detailed': '详细检查：除基础检查外，还分析句式结构问题、标点误用、搭配不当、逻辑连贯性等'
    }
    grammar_level_desc = grammar_level_map.get(request.level or 'detailed', '详细检查')

    abstract_fmt_map = {
        'structured': '结构化格式：明确标注【研究背景】、【研究目的】、【研究方法】、【研究结果】、【研究结论】五个要素',
        'unstructured': '非结构化格式：以连贯段落形式呈现，自然融入背景、目的、方法、结果和结论'
    }
    abstract_fmt_desc = abstract_fmt_map.get(request.format or 'structured', '结构化格式')
    abstract_word_count = request.word_count or 300

    rewrite_intensity_map = {
        'light': '轻度改写：主要调整句式结构和部分词汇，保持原文整体框架',
        'medium': '中度改写：全面调整表达方式和句型结构，适度重组段落内部信息',
        'deep': '深度改写：彻底重构文本，使用全新的论证角度和表达方式呈现相同内容'
    }
    rewrite_intensity_desc = rewrite_intensity_map.get(intensity, '中度改写')
    preserve_terms_text = f'【必须保留的术语】{request.preserve_terms}（这些词汇和表达必须保留原文，不得替换）' if request.preserve_terms else ''
    preserve_terms_instruction = f'6. 以下术语必须保留原文不作替换：{request.preserve_terms}' if request.preserve_terms else ''

    expand_dir_map = {
        'theory': '增加理论依据：补充相关理论背景、理论框架和学术依据',
        'methods': '补充方法细节：增加方法论描述、实验步骤和技术细节',
        'data': '深化数据分析：扩展数据解读、统计分析和结果讨论',
        'comprehensive': '综合扩写：从理论、方法和数据多个维度全面充实论述'
    }
    expand_dir_desc = expand_dir_map.get(request.expand_direction or 'comprehensive', '综合扩写')
    target_mult = request.target_multiplier or 2

    prompts = {
        "polish": f"""你是一位拥有20年经验的学术语言编辑，曾为Nature、Science、Cell等顶级期刊提供语言润色服务。

【当前模式】学术润色
【润色强度】{intensity_map_polish.get(intensity, intensity_map_polish['standard'])}
【写作风格】{style_desc}

【任务要求】
1. 提升语言的专业性、准确性和流畅度，使其符合{style_desc}
2. 严格保持原意和学术逻辑不变
3. 注意学术词汇的精确使用和句式的严谨性
4. 确保术语使用一致，避免口语化表达

请以严格的 JSON 格式输出结果：

```json
{{
  "replacement_text": "润色后的完整文本",
  "explanation": "润色说明，概述主要修改点和提升方向",
  "has_changes": true或false,
  "changes": [
    {{
      "original": "原文片段",
      "modified": "润色后的片段",
      "reason": "修改原因（如：提升专业性、修正搭配不当等）"
    }}
  ]
}}
```

【严格规则】
- 必须输出有效的 JSON 对象
- replacement_text 必须是润色后的完整文本
- 说明要简洁专业，概括主要修改
- 不要输出 JSON 代码块标记，直接输出 JSON 对象

【待润色文本】
{request.text}""",
        "translate": f"""你是一位专业的学术翻译专家，精通中英文学术写作，熟悉国际期刊发表标准。

【当前模式】中英互译
【翻译方向】{translate_dir_desc}

【任务要求】
1. 翻译符合国际学术期刊的表达习惯和专业术语规范
2. 确保学术术语准确无误，保持原意和逻辑严密
3. 优化句式结构使其符合目标语言的表达习惯
4. 保留专业术语和专有名词的原文形式（如基因名、化学式等）
5. 对于不确定的专业术语，在译文中使用最通用的学术表达

【严格规则】
- 输出必须是翻译后的文本本身
- 绝对不要输出任何解释、说明、翻译对照或标注
- 绝对不要输出"好的"、"翻译如下"、"译文为"等开头语
- 绝对不要在结尾输出任何多余内容
- 直接从翻译后的文本第一个字开始输出，到最后一个字结束

【待翻译文本】
{request.text}""",
        "grammar": f"""你是一位资深的学术文本校对专家，专注于语法、拼写、标点和语言规范性检查。

【当前模式】语法检查
【检查级别】{grammar_level_desc}

【任务要求】
请以严格的 JSON 格式输出检查结果，JSON 结构如下：

```json
{{
  "replacement_text": "修改后的完整文本，可直接替换原文",
  "explanation": "总体修改说明，概述主要发现的问题和修改原则",
  "has_changes": true或false（是否有修改）,
  "changes": [
    {{
      "original": "原文片段",
      "modified": "修改后的片段",
      "reason": "修改原因说明"
    }}
  ]
}}
```

【严格规则】
- 必须输出有效的 JSON 对象，不要任何其他文本
- replacement_text 必须是修改后的完整文本，若无修改则与原文相同
- has_changes 为布尔值，true 表示有修改，false 表示无需修改
- changes 数组包含所有具体修改项，若无修改则为空数组 []
- 每个修改项包含 original（原文）、modified（修改后）、reason（原因）
- explanation 是总体说明，概括主要问题
- 不要输出 JSON 代码块标记（```json），直接输出 JSON 对象
- JSON 中的字符串值需要正确转义换行符和引号

【待检查文本】
{request.text}""",
        "abstract": f"""你是一位学术写作专家，擅长从复杂的研究内容中提炼核心信息。

【当前模式】生成摘要
【摘要格式】{abstract_fmt_desc}
【字数要求】约 {abstract_word_count} 字

【任务要求】
1. 准确提炼研究的核心要素：背景、目的、方法、结果、结论
2. 语言精炼、准确、专业，符合学术摘要标准
3. 突出研究的创新点和主要发现
4. 严格控制在指定字数范围内

【严格规则】
- 直接输出摘要内容
- 不要输出任何解释、分析或其他无关内容
- 不要输出"该研究"、"本文"等冗余开头（除非必要）
- 直接从摘要的第一个字开始输出，到最后一个字结束

【待处理文本】
{request.text}""",
        "reduce_similarity": f"""你是一位学术论文降重专家，擅长通过深度重构降低文本重复率。

【当前模式】去重改写
【降重要求】通过句式重构、同义替换、语态转换、逻辑重述等方式有效降低文本重复率

【任务要求】
1. 通过多种方式降低与原文的相似度：
   - 句式结构全面重构（主被动转换、长短句拆分合并、从句改写等）
   - 词汇层面同义替换（学术同义词、近义表达）
   - 语态和视角转换
   - 信息重组和逻辑重述
2. 严格保持原意和学术逻辑不变
3. 确保修改后的文本符合顶级学术期刊的语言规范
4. 专业术语、专有名词、数据和引用内容不得修改

请以严格的 JSON 格式输出结果：

```json
{{
  "replacement_text": "降重后的完整文本",
  "explanation": "降重说明，概述主要采用的降重方法",
  "has_changes": true,
  "changes": [
    {{
      "original": "原文片段",
      "modified": "降重后的片段",
      "reason": "降重方法（如：句式重构、同义替换、语态转换等）"
    }}
  ]
}}
```

【严格规则】
- 必须输出有效的 JSON 对象
- replacement_text 必须是降重后的完整文本
- 说明要概括主要使用的降重方法
- 不要输出 JSON 代码块标记，直接输出 JSON 对象

【待处理文本】
{request.text}""",
        "rewrite": f"""你是一位资深的学术文本改写专家，擅长在保持原意的基础上全面重构文本表达。

【当前模式】去重改写
【改写强度】{rewrite_intensity_desc}
{preserve_terms_text}

【任务要求】
1. 用全新的表达方式和句式结构呈现相同的内容和论点
2. 严格保持原意、数据和结论不变
3. 使用完全不同的词汇和句型组合
4. 可以调整段落内部的信息顺序和论述角度
5. 确保改写后的文本达到学术论著发表标准
{preserve_terms_instruction}

请以严格的 JSON 格式输出结果：

```json
{{
  "replacement_text": "改写后的完整文本",
  "explanation": "改写说明，概述主要采用的改写策略",
  "has_changes": true,
  "changes": [
    {{
      "original": "原文片段",
      "modified": "改写后的片段",
      "reason": "改写方法（如：句式重构、词汇替换、视角转换等）"
    }}
  ]
}}
```

【严格规则】
- 必须输出有效的 JSON 对象
- replacement_text 必须是改写后的完整文本
- 说明要概括主要使用的改写策略
- 不要输出 JSON 代码块标记，直接输出 JSON 对象

【待改写文本】
{request.text}

{
    '用户额外要求：' + request.instruction if request.instruction else ''
}""",
        "expand": f"""你是一位学术写作导师，擅长帮助作者将单薄的论述扩展为充实、有深度的学术论述。

【当前模式】内容扩写
【扩写方向】{expand_dir_desc}
【目标长度】约为原文的 {target_mult} 倍

【任务要求】
1. 在保持原意不变的前提下，显著增加论述深度和广度
2. 补充相关的理论依据、方法论背景或数据解读
3. 增加合理的学术推论和深入分析
4. 使论述更加充实、论据更加充分、论证更加严密
5. 新增内容必须与原文主题高度相关，不得偏离主题

请以严格的 JSON 格式输出结果：

```json
{{
  "replacement_text": "扩写后的完整文本",
  "explanation": "扩写说明，概述新增的主要内容方向",
  "has_changes": true,
  "changes": [
    {{
      "original": "原文片段（扩展前）",
      "modified": "扩写后的片段",
      "reason": "扩写依据（如：补充理论背景、增加方法细节等）"
    }}
  ]
}}
```

【严格规则】
- 必须输出有效的 JSON 对象
- replacement_text 必须是扩写后的完整文本
- 说明要概括主要扩展的内容方向
- 不要输出 JSON 代码块标记，直接输出 JSON 对象

【待扩写文本】
{request.text}

{
    '用户额外要求：' + request.instruction if request.instruction else ''
}""",
        "shorten": f"""你是一个学术文本精简工具。你的任务是对给定的学术段落进行精简。

【当前模式】缩写精简
【任务要求】
- 保留所有核心结论和关键证据
- 去除冗余的修饰语和背景铺垫
- 使表达更加干练高效

请以严格的 JSON 格式输出结果：

```json
{{
  "replacement_text": "精简后的完整文本",
  "explanation": "精简说明，概述主要删除的冗余内容",
  "has_changes": true,
  "changes": [
    {{
      "original": "原文片段（精简前）",
      "modified": "精简后的片段",
      "reason": "精简原因（如：删除冗余修饰、合并重复内容等）"
    }}
  ]
}}
```

【严格规则】
- 必须输出有效的 JSON 对象
- replacement_text 必须是精简后的完整文本
- 说明要概括主要删除的冗余内容
- 不要输出 JSON 代码块标记，直接输出 JSON 对象

待处理文本：
{request.text}

{'用户额外要求：' + request.instruction if request.instruction else ''}""",
        "proofread": f"""你是一位资深的学术期刊审稿人，具有20年以上的审稿经验。请对以下文本进行全面的终极校对。

【当前模式】终极校对
【审查维度】语法规范性 | 逻辑连贯性 | 引用规范性 | 数据严谨性

【任务要求】
请以严格的 JSON 格式输出检查结果，JSON 结构如下：

```json
{{
  "replacement_text": "综合所有修改后的最终文本，可直接替换原文",
  "explanation": "详细的校对报告，包含四个维度的审查意见：\\n\\n一、语法规范性检查：...\\n二、逻辑连贯性检查：...\\n三、引用规范性检查：...\\n四、数据严谨性检查：...\\n五、总体评价：...",
  "has_changes": true或false（是否有修改）,
  "changes": [
    {{
      "original": "原文片段",
      "modified": "修改后的片段",
      "reason": "修改原因及所属维度"
    }}
  ]
}}
```

【严格规则】
- 必须输出有效的 JSON 对象，不要任何其他文本
- replacement_text 必须是修改后的完整文本，若无修改则与原文相同
- has_changes 为布尔值，true 表示有修改，false 表示无需修改
- explanation 是详细的校对报告，包含五个维度的审查意见（用\n\n分隔）
- changes 数组包含所有具体修改项，若无修改则为空数组 []
- 每个修改项包含 original（原文）、modified（修改后）、reason（原因及维度）
- 不要输出 JSON 代码块标记（```json），直接输出 JSON 对象
- JSON 中的字符串值需要正确转义换行符和引号
- 若某个维度未发现问题，在 explanation 中明确标注"未发现明显问题"

【待处理文本】
{request.text}""",
        "style_change": f"""你是一个文本风格调整工具。你的任务是根据用户的要求调整给定文本的文风。

【当前模式】文风调整
【任务要求】
- 在保持原意不变的前提下，使语言表达更符合指定的风格特征

请以严格的 JSON 格式输出结果：

```json
{{
  "replacement_text": "调整后的完整文本",
  "explanation": "风格调整说明，概述主要修改方向",
  "has_changes": true,
  "changes": [
    {{
      "original": "原文片段",
      "modified": "调整后的片段",
      "reason": "调整原因（如：使表达更正式、更学术等）"
    }}
  ]
}}
```

【严格规则】
- 必须输出有效的 JSON 对象
- replacement_text 必须是调整后的完整文本
- 说明要概括主要的风格调整
- 不要输出 JSON 代码块标记，直接输出 JSON 对象

待处理文本：
{request.text}

{'用户额外要求：' + request.instruction if request.instruction else ''}"""
    }

    prompt = prompts.get(request.mode, f"请处理以下文本：\n\n{request.text}")

    t0 = time.time()
    ai_response = await ai_service.chat_completion([{"role": "user", "content": prompt}])
    duration_ms = int((time.time() - t0) * 1000)
    result = ai_response["content"]

    # Post-process: clean up any AI preamble/ending that might have slipped through

    # For modes that should return structured JSON, try to parse and return
    structured_modes = ['grammar', 'proofread', 'polish', 'reduce_similarity', 'rewrite', 'expand', 'shorten', 'style_change']
    if request.mode in structured_modes:
        # Try to extract JSON from the response
        json_match = re.search(r'\{[\s\S]*\}', result)
        if json_match:
            try:
                structured_result = json.loads(json_match.group())
                # Validate structure
                if 'replacement_text' in structured_result:
                    # Ensure has_changes is boolean
                    if 'has_changes' not in structured_result:
                        structured_result['has_changes'] = (structured_result['replacement_text'] != request.text)
                    if 'changes' not in structured_result:
                        structured_result['changes'] = []
                    if 'explanation' not in structured_result:
                        structured_result['explanation'] = ''

                    # Return structured JSON
                    final_result = json.dumps(structured_result, ensure_ascii=False)

                    # Deduct token quota
                    if token_record and ai_response.get("total_tokens", 0) > 0:
                        deduct_token_quota(db, token_record.id, ai_response["total_tokens"])

                    log_generation(
                        db, mode=request.mode,
                        token_id=token_record.id if token_record else None,
                        input_text=request.text,
                        final_prompt=prompt, model_response=result,
                        output_content=final_result,
                        model=ai_service.model,
                        prompt_tokens=ai_response.get("prompt_tokens", 0),
                        completion_tokens=ai_response.get("completion_tokens", 0),
                        total_tokens=ai_response.get("total_tokens", 0),
                        duration_ms=duration_ms, status="success",
                    )
                    return {"result": final_result}
            except json.JSONDecodeError:
                # If JSON parsing fails, fall through to normal processing
                pass

        # If no JSON found or parsing failed, create a fallback structure
        fallback = {
            "replacement_text": result.strip(),
            "explanation": "检查完成",
            "has_changes": result.strip() != request.text,
            "changes": []
        }
        final_result = json.dumps(fallback, ensure_ascii=False)

        # Deduct token quota
        if token_record and ai_response.get("total_tokens", 0) > 0:
            deduct_token_quota(db, token_record.id, ai_response["total_tokens"])

        log_generation(
            db, mode=request.mode,
            token_id=token_record.id if token_record else None,
            input_text=request.text,
            final_prompt=prompt, model_response=result,
            output_content=final_result,
            model=ai_service.model,
            prompt_tokens=ai_response.get("prompt_tokens", 0),
            completion_tokens=ai_response.get("completion_tokens", 0),
            total_tokens=ai_response.get("total_tokens", 0),
            duration_ms=duration_ms, status="success",
        )
        return {"result": final_result}

    # For other modes, use the original cleanup logic
    if request.mode not in ['abstract']:
        # Remove common AI preamble patterns
        preamble_patterns = [
            r'^好的[，,、。\s]*',
            r'^以下是',
            r'^这是',
            r'^这段文本',
            r'^以下是对',
            r'^这段文字',
            r'^以下',
            r'^根据您的要求',
            r'^根据您的',
            r'^经过',
            r'^作为',
            r'^这段内容',
            r'^根据您的描述',
            r'^根据您的具体需求',
        ]
        for pattern in preamble_patterns:
            result = re.sub(pattern, '', result, flags=re.MULTILINE)

        # Remove common AI ending patterns
        ending_patterns = [
            r'[\s\n]*希望这[是符合]*您的要求[。！]*$',
            r'[\s\n]*如果[您有]*需要[进一步修改调整]*[，,、。！]*$',
            r'[\s\n]*请[您]*告知',
            r'[\s\n]*如需[要]*进一步',
            r'[\s\n]*如有[任何]*问题',
            r'[\s\n]*如果您',
        ]
        for pattern in ending_patterns:
            result = re.sub(pattern, '', result, flags=re.MULTILINE)

        # Remove markdown dividers and extra whitespace
        result = re.sub(r'\n---+\n', '\n', result)
        result = re.sub(r'\n\s*\n\s*\n', '\n\n', result)
        result = result.strip()

    # Concatenate incomplete parts with AI result
    final_result = ''
    if request.incomplete_prefix:
        final_result += request.incomplete_prefix
    final_result += result
    if request.incomplete_suffix:
        final_result += request.incomplete_suffix

    # Deduct token quota if using service token
    if token_record and ai_response.get("total_tokens", 0) > 0:
        deduct_token_quota(db, token_record.id, ai_response["total_tokens"])

    log_generation(
        db, mode=request.mode,
        token_id=token_record.id if token_record else None,
        input_text=request.text,
        final_prompt=prompt, model_response=result,
        output_content=final_result,
        model=ai_service.model,
        prompt_tokens=ai_response.get("prompt_tokens", 0),
        completion_tokens=ai_response.get("completion_tokens", 0),
        total_tokens=ai_response.get("total_tokens", 0),
        duration_ms=duration_ms, status="success",
    )
    return {"result": final_result}
