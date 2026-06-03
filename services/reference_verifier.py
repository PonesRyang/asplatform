import re
import json
import httpx
from typing import List, Optional
from io import BytesIO


class ReferenceVerifier:
    """处理用户上传的文献文件：提取文本、验证真实性、返回元数据"""

    @staticmethod
    def extract_text_from_pdf(file_bytes: bytes) -> str:
        """从 PDF 文件提取文本"""
        try:
            from pypdf import PdfReader
            reader = PdfReader(BytesIO(file_bytes))
            text = ""
            for page in reader.pages[:5]:  # 只读前5页（标题、作者、摘要通常在前面）
                text += page.extract_text() or ""
            return text
        except Exception as e:
            print(f"PDF extraction error: {e}")
            return ""

    @staticmethod
    def extract_text_from_docx(file_bytes: bytes) -> str:
        """从 Word 文件提取文本"""
        try:
            import docx2txt
            return docx2txt.process(BytesIO(file_bytes))
        except Exception as e:
            print(f"DOCX extraction error: {e}")
            return ""

    @staticmethod
    def _is_metadata_line(line: str) -> bool:
        """判断一行是否是明显的元数据/非标题内容"""
        lower = line.lower()
        # 期刊信息、DOI、ISSN、日期、版权、通信邮箱等
        metadata_patterns = [
            r'(received|accepted|published|available online|received\s+in|revised)',
            r'(doi[:\s]|10\.\d{4,})',
            r'(issn|isbn)',
            r'(vol\.|volume|issue|no\.|number|pp\.|pages)',
            r'(copyright|©|©)',
            r'\b\d{4}\b',  # 包含年份（不要求行首）
            r'(journal|conference|proceedings|preprint|arxiv)',
            r'^\s*[\d\*†‡§]+',  # 以脚注符号开头
            r'第\d+卷第\d+期',  # 中文期刊卷期
            r'\d{4}年.*第\d+卷',  # 中文期刊年份+卷
            r'\|\s*vol\s*\d',  # " | Vol 30" 模式
            r'january|february|march|april|may|june|july|august|september|october|november|december',
        ]
        metadata_keywords = [
            'doi:', 'issn', 'isbn',
            'received', 'accepted', 'published', 'copyright', '©',
            'www.', 'http://', 'https://',
            'abstract', 'keywords', 'key words', 'introduction',
            'correspondence', 'corresponding author', 'email:', 'e-mail:',
            'fig.', 'figure', 'table', 'supplementary',
            '| vol', '| volume', '| issue', '| no.',  # 期刊头分隔符
        ]

        for pattern in metadata_patterns:
            if re.search(pattern, lower):
                return True
        for kw in metadata_keywords:
            if kw in lower:
                return True
        return False

    @staticmethod
    def _looks_like_author_line(line: str) -> bool:
        """判断一行是否像作者列表"""
        lower = line.lower()
        if len(line) > 300:
            return False
        # 包含典型作者分隔符或"et al"/"等"
        has_author_sep = (
            ',' in line or
            ' and ' in line.lower() or
            '&' in line or
            'et al' in lower or
            '等' in line
        )
        if not has_author_sep:
            return False
        # 排除机构行
        if any(kw in lower for kw in ['university', 'institute', 'department', 'hospital', 'address', 'email', 'correspond']):
            return False
        # 排除摘要/关键词行
        if lower.startswith(('abstract', 'keyword', 'introduction', 'background')):
            return False
        return True

    @staticmethod
    def _looks_like_title_line(line: str) -> bool:
        """判断一行是否像论文标题的一部分"""
        # 长度检查：中文按字符数（较短），英文需要更长
        has_chinese = bool(re.search(r'[一-鿿]', line))
        if has_chinese:
            if len(line) < 5:
                return False
        else:
            if len(line) < 15:
                return False

        if len(line) > 400:
            return False

        # 硬性排除：绝不可能是标题的特征
        if any(c in line for c in ['@']):
            return False
        if 'http://' in line.lower() or 'https://' in line.lower():
            return False
        if re.match(r'^\d+[\.\)]\s', line):  # 列表项
            return False
        lower = line.lower()
        if lower.startswith(('abstract', 'keywords', 'key words', 'introduction', 'doi:', 'background', 'methods', 'results', 'conclusion')):
            return False
        # 包含机构/邮箱关键词的长行
        if len(line) > 60 and any(kw in lower for kw in ['university', 'institute', 'hospital', 'department', 'medical center', 'email', 'address']):
            return False
        # 作者行特征：
        # 模式1: "Name, Name, et al" 或 "Name, Name 等"
        if re.search(r'(et\s+al|等)\s*\.?\s*$', line, re.IGNORECASE):
            return False
        # 模式2: 逗号分隔的多个名字（需要是"姓, 名"或"名 姓, 名 姓"格式）
        # 关键：排除标题中的"and"（如"A Review and Meta-Analysis"）
        # 只触发：包含逗号+至少2个大写词（人名模式）且"and"/"&"在逗号之后
        if ',' in line and (' and ' in line.lower() or '&' in line):
            # 检查逗号后的部分是否像人名（短词，非标题功能词）
            parts = re.split(r'\s*[,，]\s*', line)
            title_words = {'and', 'or', 'the', 'a', 'an', 'of', 'in', 'for', 'on', 'with', 'from', 'to', 'by', 'at', 'is', 'are', 'was', 'were'}
            name_like_parts = [p for p in parts if p and len(p.strip()) > 2 and p.strip().split()[0].lower() not in title_words]
            if len(name_like_parts) >= 2:
                return False
        # 模式3: 中文作者 "张三, 李四, 王五" 或 "张明 1, 李华 2"
        if re.search(r'[一-鿿]{2,4}\s*[,，]\s*[一-鿿]', line):
            return False
        if re.search(r'[一-鿿]+\s+\d+\s*[,，]', line):
            return False
        # 包含数字上标标记（如 "Name 1, Name 2"）的行通常是作者+机构编号
        if re.search(r'[A-Za-z]+\s+\d+\s*[,，]', line):
            return False
        # 期刊头行：第X卷第X期、| Vol | 等
        if re.search(r'第\d+卷第\d+期', line):
            return False
        if '|' in line and re.search(r'vol|volume|issue|no\.', lower):
            return False
        # 中文期刊名行：包含年份+卷期
        if re.search(r'\d{4}年.*第\d+卷', line):
            return False
        # 中文期刊名行：仅包含年份或年月（如 "2024"、"2024年1月"）
        if re.match(r'^[一-鿿\s]*\d{4}年?\s*(\d{1,2}月)?$', line):
            return False
        # 中文期刊名单独一行 + 年份/卷期（如 "计算机学报 2024年1月"）
        if re.search(r'[一-鿿]{2,}\s+\d{4}年', line):
            return False
        # 期刊名单独一行且较短（如 "Nature Medicine"、"Science"）
        # 如果行很短（<50字）且不含学术标题特征词
        if len(line) < 50:
            # 检查是否是常见期刊名模式：1-3个大写词
            short_words = re.findall(r'[A-Z][a-z]{2,}', line)
            if 1 <= len(short_words) <= 3 and len(line.replace(' ', '').replace('-', '').replace('\'', '')) < 40:
                return False

        # 不以句号或冒号或分号结尾（问号/叹号可以）
        stripped = line.rstrip()
        if stripped.endswith(('.', ':', ';', ',')):
            return False

        # 包含足够的单词/词汇（对中文按字数计算）
        has_chinese = bool(re.search(r'[一-鿿]', line))
        if has_chinese:
            # 中文：统计汉字数量
            word_count = len(re.findall(r'[一-鿿]', line))
        else:
            # 英文：统计单词数量
            word_count = len(re.findall(r'\b\w+\b', line))
        if word_count < 3:
            return False

        return True

    @staticmethod
    def extract_metadata_from_text(text: str) -> dict:
        """从提取的文本中尝试提取标题、作者、DOI等信息"""
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        title = ""
        authors = []
        doi = ""

        # 第一阶段：在前 25 行中过滤掉明显的元数据行
        candidate_lines = []
        for i, line in enumerate(lines[:25]):
            if ReferenceVerifier._is_metadata_line(line):
                lower = line.lower()
                # 一旦遇到摘要或关键词，停止搜索
                if any(kw in lower for kw in ['abstract', 'keywords', 'key words', 'introduction', 'background']):
                    break
                continue
            candidate_lines.append((i, line))

        # 第二阶段：从候选行中提取标题
        # 标题可能是连续的 1-2 行，但要遇到作者行就停止
        title_lines = []
        for idx in range(len(candidate_lines)):
            _, line = candidate_lines[idx]

            # 如果这行看起来像作者，标题搜索结束
            if ReferenceVerifier._looks_like_author_line(line) and title_lines:
                break

            if ReferenceVerifier._looks_like_title_line(line):
                title_lines.append(line)
                # 检查后续行是否也是标题的一部分（标题跨行）
                # 中文标题可能跨 3 行，英文通常最多 2 行
                has_chinese_in_title = any(bool(re.search(r'[一-鿿]', l)) for l in title_lines)
                max_title_lines = 3 if has_chinese_in_title else 2
                while len(title_lines) < max_title_lines and idx + 1 < len(candidate_lines):
                    next_i, next_line = candidate_lines[idx + 1]
                    # 只有当下一行紧跟且符合标题特征且不是作者行时才合并
                    if (next_i - candidate_lines[idx][0] <= 2 and
                        ReferenceVerifier._looks_like_title_line(next_line) and
                        not ReferenceVerifier._looks_like_author_line(next_line)):
                        title_lines.append(next_line)
                        idx += 1
                    else:
                        break
                break  # 找到标题后不再继续搜索
            # 如果既不是元数据也不是标题也不是作者，可能是短的作者名，跳过继续

        # 合并标题行
        if title_lines:
            title = " ".join(title_lines)
            title = re.sub(r'\s+', ' ', title).strip()

        # 第三阶段：在标题之后查找作者行
        if title:
            # 找到标题结束在 candidate_lines 中的位置
            title_last_line = title_lines[-1] if title_lines else ""
            title_end_in_candidates = -1
            for idx, (_, line) in enumerate(candidate_lines):
                if line == title_last_line:
                    title_end_in_candidates = idx

            start_search = title_end_in_candidates + 1 if title_end_in_candidates >= 0 else 0
            for idx in range(start_search, min(start_search + 10, len(candidate_lines))):
                _, candidate = candidate_lines[idx]
                if ReferenceVerifier._looks_like_author_line(candidate):
                    # 解析作者名
                    cleaned = re.sub(r'\s*et\s+al\.?\s*$', '', candidate, flags=re.IGNORECASE)
                    cleaned = re.sub(r'\s*等\s*$', '', cleaned)
                    cleaned = re.sub(r'\s*&\s*', ', ', cleaned)
                    cleaned = re.sub(r'\s+and\s+', ', ', cleaned, flags=re.IGNORECASE)
                    # 去除机构编号（如 "Name 1" -> "Name"）
                    cleaned = re.sub(r'\s+\d+\s*$', '', cleaned)
                    cleaned = re.sub(r'\s+\d+\s*[,，]', ', ', cleaned)
                    authors = [a.strip() for a in re.split(r'[,，]', cleaned) if a.strip() and len(a.strip()) >= 2 and '@' not in a]
                    break

        # 尝试从文本中找 DOI
        doi_match = re.search(r'10\.\d{4,}[^\s"\')\]]+', text)
        if doi_match:
            doi = doi_match.group(0).rstrip('.,;)')

        return {"title": title, "authors": authors, "doi": doi}

    @staticmethod
    async def extract_metadata_with_ai(text_preview: str) -> dict:
        """使用大模型从文献文本中提取标题、作者、DOI、摘要、年份、期刊等信息"""
        from services import ai_service

        prompt = f"""请从以下学术论文的开头部分提取元数据信息。以 JSON 格式返回，不要返回其他内容。

需要提取的字段：
- title: 论文标题（完整标题，不含期刊名、卷期号等）
- authors: 作者列表（数组，仅包含作者姓名）
- doi: DOI（如果有）
- abstract: 摘要内容（如果有，截取前500字即可）
- year: 发表年份（如果有）
- journal: 期刊/会议名称（如果有）

重要规则：
1. 标题不要包含期刊名、卷期号、接收日期等元数据
2. 作者列表不要包含机构名称、邮箱、"et al"、"等"
3. 如果某个字段无法提取，返回空字符串或空数组
4. 只返回 JSON，不要包含 markdown 代码块或其他文本

论文文本（前3000字符）：
---
{text_preview[:3000]}
---

请返回 JSON："""

        try:
            result = await ai_service.chat_completion(
                messages=[
                    {"role": "system", "content": "You are an academic metadata extraction assistant. You extract title, authors, DOI, abstract, year, and journal from academic paper text. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1
            )

            content = result.get("content", "")

            # 尝试从返回内容中提取 JSON（可能包含 markdown 代码块）
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                data = json.loads(json_match.group(0))
                return {
                    "title": str(data.get("title", "") or "").strip(),
                    "authors": [str(a) for a in data.get("authors", []) if a],
                    "doi": str(data.get("doi", "") or "").strip(),
                    "abstract": str(data.get("abstract", "") or "").strip(),
                    "year": str(data.get("year", "") or "").strip(),
                    "journal": str(data.get("journal", "") or "").strip(),
                }
            return {"title": "", "authors": [], "doi": "", "abstract": "", "year": "", "journal": ""}
        except Exception as e:
            print(f"AI metadata extraction failed: {e}")
            return {"title": "", "authors": [], "doi": "", "abstract": "", "year": "", "journal": ""}

    @staticmethod
    async def check_relevance_with_ai(title: str, abstract_preview: str, relevance_context: dict) -> dict:
        """使用大模型检查文献是否与研究主题/学科/关键词相关"""
        from services import ai_service

        if not relevance_context:
            return {"relevant": True, "reason": ""}

        context_parts = []
        if relevance_context.get("topic"):
            context_parts.append(f"- 研究主题/方向：{relevance_context['topic']}")
        if relevance_context.get("discipline"):
            context_parts.append(f"- 所属学科：{relevance_context['discipline']}")
        if relevance_context.get("keywords"):
            context_parts.append(f"- 关键词：{', '.join(relevance_context['keywords'])}")

        context_text = "\n".join(context_parts)

        prompt = f"""请判断以下学术论文是否与指定的研究主题相关。

【研究背景信息】
{context_text}

【论文信息】
标题：{title}
摘要：{abstract_preview[:500]}

请以 JSON 格式返回，包含两个字段：
- relevance_level: "high"、"medium" 或 "low"
- reason: 如果完全不相关，用一句话简述原因；否则为空字符串

判断标准（宽松标准，只要可能用到就视为相关）：
1. high：论文直接研究相同主题、疾病、方法或关键词
2. medium：论文在方法学、背景理论、相关领域方面有可借鉴之处
3. low：论文与研究大方向有一定关联，可能在引言或讨论部分用得上
4. 仅当论文与研究领域完全不相干（如给定主题是医学但论文是关于金融或古代文学）时标记为 low

注意：宽松判断，medium 和 high 都应保留，只有完全不相关的才标记为 low。

返回 JSON："""

        try:
            result = await ai_service.chat_completion(
                messages=[
                    {"role": "system", "content": "You are an academic relevance assessment assistant. Assess whether a paper is relevant to a given research topic. Respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1
            )

            content = result.get("content", "")
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                data = json.loads(json_match.group(0))
                level = str(data.get("relevance_level", "high")).lower()
                # Only reject completely irrelevant papers (level == "low")
                is_relevant = level in ("high", "medium")
                return {
                    "relevant": is_relevant,
                    "relevance_level": level,
                    "reason": str(data.get("reason", "") or "")
                }
            return {"relevant": True, "relevance_level": "high", "reason": ""}
        except Exception as e:
            print(f"AI relevance check failed: {e}")
            return {"relevant": True, "relevance_level": "high", "reason": ""}

    @staticmethod
    def _title_similarity_match(title: str, api_title: str) -> dict:
        """Check if two titles are similar enough to be the same paper.

        Returns a dict with {'match': bool, 'score': float}
        Only exact or near-exact matches should pass.
        """
        has_chinese = bool(re.search(r'[一-鿿]', title))
        has_chinese_api = bool(re.search(r'[一-鿿]', api_title))

        if has_chinese or has_chinese_api:
            # Chinese: use bigram (2-character sequence) Jaccard similarity
            def get_bigrams(s):
                return set(s[i:i+2] for i in range(len(s)-1))

            # Don't filter out common words - they are part of the title identity
            if not title or not api_title:
                return {'match': False, 'score': 0.0}

            bigrams = get_bigrams(title)
            api_bigrams = get_bigrams(api_title)
            if not bigrams or not api_bigrams:
                return {'match': False, 'score': 0.0}

            # Use the smaller set as denominator - this ensures short title matching long title works
            overlap = len(bigrams & api_bigrams)
            denominator = min(len(bigrams), len(api_bigrams))
            score = overlap / denominator if denominator > 0 else 0.0

            # Threshold: Chinese titles need very high similarity (90%) to be considered the same paper
            return {'match': score >= 0.90, 'score': score}
        else:
            # English: word-level similarity, using shorter title as denominator
            title_words = set(title.lower().split())
            api_words = set(api_title.lower().split())
            if not title_words:
                return {'match': False, 'score': 0.0}
            overlap = len(title_words & api_words)
            denominator = min(len(title_words), len(api_words))
            score = overlap / denominator if denominator > 0 else 0.0

            # Threshold: English titles need 90% of the shorter title's words to match
            return {'match': score >= 0.90, 'score': score}

    @staticmethod
    async def verify_paper_crossref(title: str, doi: str = "") -> Optional[dict]:
        """通过 CrossRef API 验证论文真实性"""
        if not title or len(title) < 5:
            return None

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                if doi:
                    # Direct DOI lookup
                    resp = await client.get(
                        f"https://api.crossref.org/works/{doi}",
                        params={"select": "title,author,DOI,published-print,published-online,container-title"}
                    )
                else:
                    # Search by title
                    resp = await client.get(
                        "https://api.crossref.org/works",
                        params={"query.title": title, "rows": 1, "select": "title,author,DOI,published-print,published-online,container-title"}
                    )

                if resp.status_code != 200:
                    return None

                data = resp.json()

                if doi:
                    # Direct DOI lookup
                    item = data.get("message", {})
                else:
                    # Search results
                    items = data.get("message", {}).get("items", [])
                    if not items:
                        return None
                    item = items[0]

                # Check title similarity to confirm it's the right paper
                api_title = " ".join(item.get("title", []))
                if not api_title:
                    return None

                # Title similarity check (supports both English and Chinese)
                sim = ReferenceVerifier._title_similarity_match(title, api_title)
                if not sim['match']:
                    return None

                # Extract metadata
                pub_date = ""
                if "published-print" in item and "date-parts" in item["published-print"]:
                    parts = item["published-print"]["date-parts"][0]
                    pub_date = "-".join(str(p) for p in parts if p)
                elif "published-online" in item and "date-parts" in item["published-online"]:
                    parts = item["published-online"]["date-parts"][0]
                    pub_date = "-".join(str(p) for p in parts if p)

                year = pub_date.split("-")[0] if pub_date else "n.d."

                api_authors = []
                for author in item.get("author", [])[:10]:
                    parts = []
                    if "given" in author:
                        parts.append(author["given"])
                    if "family" in author:
                        parts.append(author["family"])
                    if parts:
                        api_authors.append(" ".join(parts))

                paper_doi = item.get("DOI", "")
                source = item.get("container-title", [""])[0] if item.get("container-title") else ""

                return {
                    "title": api_title,
                    "authors": api_authors,
                    "doi": paper_doi,
                    "year": year,
                    "source": source,
                    "verified": True,
                    "database": "CrossRef",
                    "similarity_score": round(sim['score'], 3)
                }
            except Exception as e:
                print(f"CrossRef verification error: {e}")
                return None

    @staticmethod
    async def verify_paper_crossref_by_title(title: str) -> Optional[dict]:
        """通过 CrossRef API 按标题搜索论文（对中文论文使用 query.bibliographic 提高命中率）"""
        if not title or len(title) < 5:
            return None

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                # 先用 query.bibliographic（全文匹配），对中文论文效果更好
                resp = await client.get(
                    "https://api.crossref.org/works",
                    params={
                        "query.bibliographic": title,
                        "rows": 3,
                        "select": "title,author,DOI,published-print,published-online,container-title"
                    }
                )

                if resp.status_code != 200:
                    return None

                data = resp.json()
                items = data.get("message", {}).get("items", [])

                best_match = None
                best_score = 0

                for item in items:
                    api_title = " ".join(item.get("title", []))
                    if not api_title:
                        continue

                    sim = ReferenceVerifier._title_similarity_match(title, api_title)
                    if sim['score'] > best_score:
                        best_score = sim['score']
                        best_match = item

                if not best_match or best_score < 0.90:
                    return None

                item = best_match
                api_title = " ".join(item.get("title", []))

                # Extract metadata
                pub_date = ""
                if "published-print" in item and "date-parts" in item["published-print"]:
                    parts = item["published-print"]["date-parts"][0]
                    pub_date = "-".join(str(p) for p in parts if p)
                elif "published-online" in item and "date-parts" in item["published-online"]:
                    parts = item["published-online"]["date-parts"][0]
                    pub_date = "-".join(str(p) for p in parts if p)

                year = pub_date.split("-")[0] if pub_date else "n.d."

                api_authors = []
                for author in item.get("author", [])[:10]:
                    parts = []
                    if "given" in author:
                        parts.append(author["given"])
                    if "family" in author:
                        parts.append(author["family"])
                    if parts:
                        api_authors.append(" ".join(parts))

                paper_doi = item.get("DOI", "")
                source = item.get("container-title", [""])[0] if item.get("container-title") else ""

                return {
                    "title": api_title,
                    "authors": api_authors,
                    "doi": paper_doi,
                    "year": year,
                    "source": source,
                    "verified": True,
                    "database": "CrossRef",
                    "similarity_score": round(best_score, 3)
                }
            except Exception as e:
                print(f"CrossRef by-title verification error: {e}")
                return None

    @staticmethod
    async def verify_paper_europepmc(title: str) -> Optional[dict]:
        """通过 Europe PMC API 验证论文真实性，尝试多种查询策略"""
        if not title or len(title) < 5:
            return None

        # Has Chinese? Europe PMC mainly indexes English papers, but try anyway
        has_chinese = bool(re.search(r'[一-鿿]', title))
        if has_chinese and len(title) > 50:
            # For long Chinese titles, extract key terms
            # Remove common function words to get search keywords
            filler = re.compile(r'[的了在是一是与及对对于中关于基于研究分析应用]')
            key_terms = filler.sub('', title)
            if len(key_terms) > 10:
                # Try searching with key terms
                return await ReferenceVerifier._europepmc_search(key_terms, title)

        return await ReferenceVerifier._europepmc_search(title, title)

    @staticmethod
    async def _europepmc_search(query: str, original_title: str) -> Optional[dict]:
        """Internal Europe PMC search method"""
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                params = {"query": query, "format": "json", "resultType": "core", "pageSize": 5}
                resp = await client.get(
                    "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
                    params=params
                )

                if resp.status_code != 200:
                    return None

                data = resp.json()
                results = data.get("resultList", {}).get("result", [])
                if not results:
                    return None

                # Find the best match among results
                best_match = None
                best_score = 0

                for item in results:
                    api_title = item.get("title", "")
                    sim = ReferenceVerifier._title_similarity_match(original_title, api_title)
                    if sim['score'] > best_score:
                        best_score = sim['score']
                        best_match = item

                if not best_match or best_score < 0.90:
                    return None

                item = best_match
                api_title = item.get("title", "")

                authors = []
                if item.get("authorString"):
                    authors = [a.strip() for a in re.split(r'[,，]', item.get("authorString", "")) if a.strip()]

                return {
                    "title": api_title,
                    "authors": authors,
                    "doi": item.get("doi", ""),
                    "year": item.get("pubYear", "n.d."),
                    "source": item.get("journalTitle", ""),
                    "verified": True,
                    "database": "EuropePMC",
                    "similarity_score": round(best_score, 3)
                }
            except Exception as e:
                print(f"EuropePMC search error: {e}")
                return None

    @staticmethod
    async def verify_paper_arxiv(title: str) -> Optional[dict]:
        """通过 arXiv API 验证论文真实性"""
        if not title or len(title) < 5:
            return None

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                # arXiv API uses ATOM XML format
                query_title = title.replace(' ', '+').replace('&', '%26')
                url = f"http://export.arxiv.org/api/query?search_query=ti:{query_title}&max_results=1"
                resp = await client.get(url)

                if resp.status_code != 200:
                    return None

                xml_text = resp.text

                # Parse ATOM XML to extract entry
                entry_match = re.search(r'<entry>(.*?)</entry>', xml_text, re.DOTALL)
                if not entry_match:
                    return None

                entry = entry_match.group(1)

                title_match = re.search(r'<title[^>]*>(.*?)</title>', entry, re.DOTALL)
                if not title_match:
                    return None

                api_title = re.sub(r'\s+', ' ', title_match.group(1)).strip()

                # Similarity check
                sim = ReferenceVerifier._title_similarity_match(title, api_title)
                if not sim['match']:
                    return None

                # Extract authors
                api_authors = re.findall(r'<name>(.*?)</name>', entry)

                # Extract published date
                published_match = re.search(r'<published>(\d{4})', entry)
                year = published_match.group(1) if published_match else "n.d."

                # Extract arXiv ID
                id_match = re.search(r'<id>http://arxiv.org/abs/([^/]+)</id>', entry)
                arxiv_id = id_match.group(1) if id_match else ""

                return {
                    "title": api_title,
                    "authors": api_authors,
                    "doi": arxiv_id,
                    "year": year,
                    "source": "arXiv",
                    "verified": True,
                    "database": "arXiv",
                    "similarity_score": round(sim['score'], 3)
                }
            except Exception as e:
                print(f"arXiv verification error: {e}")
                return None
