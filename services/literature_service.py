import httpx
import asyncio
import time
import re
import json
import xml.etree.ElementTree as ET
from typing import List, Optional


class LiteratureService:
    def __init__(self):
        self.pubmed_base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
        self.europepmc_base = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
        self.doaj_base = "https://doaj.org/api/v2/search/journals"
        self.arxiv_base = "https://export.arxiv.org/api/query"
        self.crossref_base = "https://api.crossref.org/works"
        self.openalex_base = "https://api.openalex.org/works"
        # Simple in-memory cache: {query: {citations: [], timestamp: float}}
        self.cache = {}
        self.cache_ttl = 3600  # Cache for 1 hour
        self.pubmed_query_cache = {}
        self.arxiv_query_cache = {}
        self.plain_english_query_cache = {}

    def _search_adapters(self):
        return {
            "pubmed": self._search_pubmed,
            "europepmc": self._search_europepmc,
            "crossref": self._search_crossref,
            "arxiv": self._search_arxiv,
            "openalex": self._search_openalex,
        }

    def _has_cjk(self, value: str) -> bool:
        return bool(re.search(r"[\u4e00-\u9fff]", value or ""))

    def _strip_json_fence(self, content: str) -> str:
        text = (content or "").strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        return text.strip()

    def _local_pubmed_concepts(self, query: str) -> List[List[str]]:
        dictionary = {
            "肿瘤": ["neoplasms", "cancer", "tumor"],
            "癌": ["neoplasms", "cancer", "carcinoma"],
            "癌症": ["neoplasms", "cancer"],
            "白血病": ["leukemia"],
            "肺癌": ["lung neoplasms", "lung cancer"],
            "乳腺癌": ["breast neoplasms", "breast cancer"],
            "胃癌": ["stomach neoplasms", "gastric cancer"],
            "肝癌": ["liver neoplasms", "hepatocellular carcinoma"],
            "结直肠癌": ["colorectal neoplasms", "colorectal cancer"],
            "糖尿病": ["diabetes mellitus"],
            "高血压": ["hypertension"],
            "冠心病": ["coronary artery disease"],
            "心肌梗死": ["myocardial infarction"],
            "心力衰竭": ["heart failure"],
            "脑卒中": ["stroke"],
            "阿尔茨海默病": ["alzheimer disease"],
            "帕金森病": ["parkinson disease"],
            "慢阻肺": ["pulmonary disease, chronic obstructive", "COPD"],
            "哮喘": ["asthma"],
            "肥胖": ["obesity"],
            "炎症": ["inflammation"],
            "免疫": ["immunity", "immune response"],
            "感染": ["infection"],
            "机器学习": ["machine learning"],
            "深度学习": ["deep learning"],
            "人工智能": ["artificial intelligence"],
            "预测模型": ["prediction model", "risk prediction"],
            "风险预测": ["risk prediction"],
            "生物标志物": ["biomarkers"],
            "基因": ["genes"],
            "蛋白": ["proteins"],
            "代谢": ["metabolism"],
            "表型": ["phenotype"],
            "诊断": ["diagnosis"],
            "治疗": ["therapy", "treatment"],
            "预后": ["prognosis"],
            "队列": ["cohort studies"],
            "随机对照": ["randomized controlled trial"],
            "荟萃分析": ["meta-analysis"],
            "系统评价": ["systematic review"],
        }
        concepts = []
        for phrase, terms in sorted(dictionary.items(), key=lambda item: len(item[0]), reverse=True):
            if phrase in query:
                concepts.append(terms)
        deduped = []
        seen = set()
        for terms in concepts:
            key = tuple(term.lower() for term in terms)
            if key not in seen:
                deduped.append(terms)
                seen.add(key)
        return deduped[:5]

    def _pubmed_clause(self, terms: List[str]) -> Optional[str]:
        parts = []
        for term in terms:
            value = re.sub(r"\s+", " ", str(term or "").strip())
            if not value or self._has_cjk(value):
                continue
            escaped = value.replace('"', "")
            parts.append(f'"{escaped}"[MeSH Terms]')
            parts.append(f'"{escaped}"[Title/Abstract]')
        if not parts:
            return None
        return "(" + " OR ".join(dict.fromkeys(parts)) + ")"

    def _compose_pubmed_query(self, concepts: List[List[str]]) -> Optional[str]:
        clauses = [self._pubmed_clause(terms) for terms in concepts]
        clauses = [clause for clause in clauses if clause]
        if not clauses:
            return None
        return " AND ".join(clauses[:5])

    async def _ai_pubmed_concepts(self, query: str) -> List[List[str]]:
        try:
            from services import ai_service

            prompt = f"""请把下面中文医学/科研检索词抽取为 PubMed 适用的英文关键词和 MeSH 候选词。
只输出 JSON，不要 Markdown，不要解释。

输入：{query}

输出格式：
{{"concepts":[{{"terms":["english term","MeSH term","synonym"]}}]}}

要求：
1. 每个 concepts 元素表示一个核心概念，同一概念内 terms 是近义词。
2. 最多 5 个核心概念，每个概念最多 4 个英文词。
3. 不要输出中文。"""
            result = await ai_service.chat_completion([{"role": "user", "content": prompt}], temperature=0.1)
            content = result.get("content", "")
            if content.startswith("[Mock Response]") or content.startswith("AI 服务"):
                return []
            data = json.loads(self._strip_json_fence(content))
            concepts = []
            for concept in data.get("concepts", []):
                terms = concept.get("terms", [])
                if isinstance(terms, list):
                    clean = [
                        re.sub(r"\s+", " ", str(term).strip())
                        for term in terms
                        if str(term).strip() and not self._has_cjk(str(term))
                    ]
                    if clean:
                        concepts.append(clean[:4])
            return concepts[:5]
        except Exception as e:
            print(f"PubMed query expansion error: {e}")
            return []

    async def _build_pubmed_query(self, query: str) -> str:
        if not self._has_cjk(query):
            return query

        if query in self.pubmed_query_cache:
            return self.pubmed_query_cache[query]

        concepts = self._local_pubmed_concepts(query)
        ai_concepts = []
        if len(concepts) < 2:
            ai_concepts = await self._ai_pubmed_concepts(query)

        merged = concepts[:]
        existing_terms = {term.lower() for group in merged for term in group}
        for group in ai_concepts:
            fresh = [term for term in group if term.lower() not in existing_terms]
            if fresh:
                merged.append(fresh)
                existing_terms.update(term.lower() for term in fresh)

        expanded = self._compose_pubmed_query(merged)
        effective_query = expanded or query
        self.pubmed_query_cache[query] = effective_query
        return effective_query

    def _arxiv_clause(self, terms: List[str]) -> Optional[str]:
        parts = []
        for term in terms:
            value = re.sub(r"\s+", " ", str(term or "").strip())
            if not value or self._has_cjk(value):
                continue
            escaped = value.replace('"', "")
            if " " in escaped:
                parts.append(f'all:"{escaped}"')
            else:
                parts.append(f"all:{escaped}")
        if not parts:
            return None
        return "(" + " OR ".join(dict.fromkeys(parts)) + ")"

    def _compose_arxiv_query(self, concepts: List[List[str]]) -> Optional[str]:
        clauses = [self._arxiv_clause(terms) for terms in concepts]
        clauses = [clause for clause in clauses if clause]
        if not clauses:
            return None
        return " AND ".join(clauses[:5])

    async def _build_arxiv_query(self, query: str) -> str:
        if not self._has_cjk(query):
            return f"all:{query}"

        if query in self.arxiv_query_cache:
            return self.arxiv_query_cache[query]

        concepts = self._local_pubmed_concepts(query)
        ai_concepts = []
        if len(concepts) < 2:
            ai_concepts = await self._ai_pubmed_concepts(query)

        merged = concepts[:]
        existing_terms = {term.lower() for group in merged for term in group}
        for group in ai_concepts:
            fresh = [term for term in group if term.lower() not in existing_terms]
            if fresh:
                merged.append(fresh)
                existing_terms.update(term.lower() for term in fresh)

        expanded = self._compose_arxiv_query(merged)
        effective_query = expanded or f"all:{query}"
        self.arxiv_query_cache[query] = effective_query
        return effective_query

    async def _build_plain_english_query(self, query: str) -> str:
        if not self._has_cjk(query):
            return query

        if query in self.plain_english_query_cache:
            return self.plain_english_query_cache[query]

        concepts = self._local_pubmed_concepts(query)
        ai_concepts = []
        if len(concepts) < 2:
            ai_concepts = await self._ai_pubmed_concepts(query)

        merged = concepts[:]
        existing_terms = {term.lower() for group in merged for term in group}
        for group in ai_concepts:
            fresh = [term for term in group if term.lower() not in existing_terms]
            if fresh:
                merged.append(fresh)
                existing_terms.update(term.lower() for term in fresh)

        english_terms = []
        for group in merged[:5]:
            for term in group:
                if term and not self._has_cjk(term):
                    english_terms.append(term)
                    break
        effective_query = " ".join(english_terms) or query
        self.plain_english_query_cache[query] = effective_query
        return effective_query

    def _format_citation(self, authors: List[str], title: str, source: str, pubdate: str, doi: str = "", style: str = "apa") -> dict:
        """Format a citation with full metadata in specified style

        Args:
            authors: List of author names
            title: Article title
            source: Journal/source name
            pubdate: Publication date
            doi: Digital Object Identifier
            style: Citation style ('apa', 'vancouver', 'gbt7714', 'ama', 'chicago')
        """
        # Clean pubdate
        year = pubdate.split('-')[0] if pubdate else "n.d."

        # Format authors based on style
        authors_str = ", ".join(authors[:3]) + (" et al." if len(authors) > 3 else "")
        authors_full = ", ".join(authors)
        authors_abbreviated = authors[0] + " et al." if len(authors) > 1 else (authors[0] if authors else "n.a.")

        # Get last name of first author for Vancouver/AMA
        first_author_last = authors[0].split()[-1] if authors else "n.a."

        # Build link
        link = f"https://doi.org/{doi}" if doi else ""

        # Format according to style
        if style == "apa":
            # APA 7th: Author, A. A., Author, B. B., & Author, C. C. (Year). Title of article. *Source Name*, *Volume*(Issue), pages. DOI
            formatted = f"{authors_str} ({year}). {title}. {source}." + (f" https://doi.org/{doi}" if doi else "")
        elif style == "vancouver":
            # Vancouver: Author AA, Author BB, Author CC. Title. Source. Year;Volume(Issue):Pages. DOI
            authors_vanc = "".join([author.split()[-1] + "".join([n[0] for n in author.split()[:-1]]) for author in authors[:3]])
            if len(authors) > 6:
                authors_vanc += ", et al"
            elif len(authors) > 3:
                authors_vanc += ", et al"
            formatted = f"{authors_vanc}. {title}. {source}. {year}" + (f". https://doi.org/{doi}" if doi else "")
        elif style == "gbt7714":
            # GB/T 7714-2015 (Chinese standard): 作者. 题名[J]. 期刊名, 年, 卷(期): 页码. DOI
            authors_gbt = ", ".join(authors[:3])
            if len(authors) > 3:
                authors_gbt += ", 等"
            formatted = f"{authors_gbt}. {title}[J]. {source}, {year}" + (f". {doi}" if doi else "")
        elif style == "ama":
            # AMA: Author AA, Author BB, Author CC. Title. Source. Year;Volume(Issue):Pages. DOI
            authors_ama = ", ".join([author.split()[-1] + " " + "".join([n[0] for n in author.split()[:-1]]) for author in authors[:3]])
            if len(authors) > 6:
                authors_ama += ", et al"
            elif len(authors) > 3:
                authors_ama += ", et al"
            formatted = f"{authors_ama}. {title}. {source}. {year}" + (f". doi:{doi}" if doi else "")
        elif style == "chicago":
            # Chicago: Author, First. "Title of Article." Source Name (Year). DOI
            authors_chi = ". ".join(authors[:3])
            if len(authors) > 3:
                authors_chi += ", et al."
            formatted = f'{authors_chi} "{title}." {source} ({year}).' + (f" https://doi.org/{doi}" if doi else "")
        else:
            # Default to APA
            formatted = f"{authors_str} ({year}). {title}. {source}." + (f" https://doi.org/{doi}" if doi else "")

        return {
            "authors": authors,
            "title": title,
            "source": source,
            "year": year,
            "doi": doi,
            "formatted": formatted,
            "database": "PubMed",
            "link": link
        }

    async def _search_pubmed(self, query: str, max_results: int = 5) -> List[dict]:
        """Search PubMed for real academic literature"""
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            try:
                effective_query = await self._build_pubmed_query(query)
                # Search for PMIDs
                search_params = {
                    "db": "pubmed",
                    "term": effective_query,
                    "retmax": max_results,
                    "retmode": "json",
                    "sort": "relevance"
                }
                search_resp = await client.get(f"{self.pubmed_base}/esearch.fcgi", params=search_params)
                if search_resp.status_code != 200:
                    return []

                pmids = search_resp.json().get("esearchresult", {}).get("idlist", [])
                if not pmids:
                    return []

                # Fetch summaries. Prefer JSON because it is less brittle than XML
                # across NCBI response variants; keep XML parsing as a fallback.
                summary_params = {
                    "db": "pubmed",
                    "id": ",".join(pmids[:max_results]),
                    "retmode": "json"
                }
                summary_resp = await client.get(f"{self.pubmed_base}/esummary.fcgi", params=summary_params)
                if summary_resp.status_code != 200:
                    return []

                results = []
                try:
                    data = summary_resp.json().get("result", {})
                    for pmid in data.get("uids", [])[:max_results]:
                        item = data.get(pmid, {})
                        title = item.get("title", "")
                        authors = [
                            author.get("name", "")
                            for author in item.get("authors", [])
                            if isinstance(author, dict) and author.get("name")
                        ]
                        source = item.get("source", "")
                        pubdate = item.get("pubdate", "")
                        doi = ""
                        for article_id in item.get("articleids", []):
                            if article_id.get("idtype") == "doi":
                                doi = article_id.get("value", "")
                                break

                        if title:
                            citation = self._format_citation(authors, title, source, pubdate, doi, style="apa")
                            citation["pmid"] = pmid
                            if pmid and not citation.get("link"):
                                citation["link"] = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}"
                            results.append(citation)
                except Exception:
                    results = []

                if results:
                    return results

                summary_params["retmode"] = "xml"
                summary_resp = await client.get(f"{self.pubmed_base}/esummary.fcgi", params=summary_params)
                if summary_resp.status_code != 200:
                    return []

                root = ET.fromstring(summary_resp.text)
                for doc_sum in root.findall(".//DocSum"):
                    title = ""
                    source = ""
                    pubdate = ""
                    authors = []
                    doi = ""
                    pmid = doc_sum.find("Id").text if doc_sum.find("Id") is not None else ""

                    for item in doc_sum.findall("Item"):
                        name = item.get("Name")
                        if name == "Title":
                            title = item.text or ""
                        elif name == "Source":
                            source = item.text or ""
                        elif name == "PubDate":
                            pubdate = item.text or ""
                        elif name == "AuthorList":
                            for author in item.findall("Item"):
                                if author.text:
                                    authors.append(author.text)
                        elif name == "DOI":
                            doi = item.text or ""

                    if title:
                        citation = self._format_citation(authors, title, source, pubdate, doi, style="apa")
                        citation["pmid"] = pmid
                        if pmid and not citation.get("link"):
                            citation["link"] = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}"
                        results.append(citation)

                return results
            except Exception as e:
                print(f"PubMed search error: {e}")
                return []

    async def _search_europepmc(self, query: str, max_results: int = 5) -> List[dict]:
        """Search Europe PMC for additional literature"""
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            try:
                params = {
                    "query": query,
                    "format": "json",
                    "pageSize": max_results,
                    "resultType": "core"
                }
                resp = await client.get(self.europepmc_base, params=params)
                if resp.status_code != 200:
                    return []

                data = resp.json()
                results = []
                for article in data.get("resultList", {}).get("result", [])[:max_results]:
                    title = article.get("title", "")

                    # Robust author parsing
                    authors = []
                    author_list = article.get("authorList", {}).get("author", [])
                    if isinstance(author_list, list):
                        for a in author_list:
                            if isinstance(a, dict):
                                authors.append(a.get("fullName", ""))
                            elif isinstance(a, str):
                                authors.append(a)
                    authors = [a for a in authors if a]

                    source = article.get("journalTitle", "") or article.get("source", "")
                    pubdate = article.get("pubYear", "")
                    doi = article.get("doi", "")

                    if title:
                        citation = self._format_citation(authors, title, source, str(pubdate), doi, style="apa")
                        citation["database"] = "Europe PMC"
                        # Ensure real URL for Europe PMC
                        if doi:
                            citation["link"] = f"https://doi.org/{doi}"
                        elif article.get("pmid"):
                            citation["link"] = f"https://pubmed.ncbi.nlm.nih.gov/{article.get('pmid')}"
                        results.append(citation)

                return results
            except Exception as e:
                print(f"Europe PMC search error: {e}")
                return []

    async def _search_crossref(self, query: str, max_results: int = 5) -> List[dict]:
        """Search CrossRef for DOI-registered literature"""
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            try:
                params = {
                    "query": query,
                    "rows": max_results,
                    "select": "DOI,title,author,container-title,published-print,published-online"
                }
                resp = await client.get(self.crossref_base, params=params)
                if resp.status_code != 200:
                    return []

                data = resp.json()
                results = []
                for item in data.get("message", {}).get("items", [])[:max_results]:
                    title = item.get("title", [""])[0]
                    authors = [f"{a.get('given', '')} {a.get('family', '')}".strip()
                              for a in item.get("author", [])]
                    source = item.get("container-title", [""])[0]
                    pubdate = item.get("published-print", {}).get("date-parts", [[""]])[0][0]
                    if not pubdate:
                        pubdate = item.get("published-online", {}).get("date-parts", [[""]])[0][0]
                    doi = item.get("DOI", "")

                    if title:
                        citation = self._format_citation(authors, title, source, str(pubdate), doi, style="apa")
                        citation["database"] = "CrossRef"
                        results.append(citation)

                return results
            except Exception as e:
                print(f"CrossRef search error: {e}")
                return []

    async def _search_arxiv(self, query: str, max_results: int = 5) -> List[dict]:
        """Search arXiv for preprints (useful for CS, Physics, Math)"""
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            try:
                search_query = await self._build_arxiv_query(query)
                params = {
                    "search_query": search_query,
                    "start": 0,
                    "max_results": max_results,
                    "sortBy": "relevance",
                    "sortOrder": "descending"
                }
                resp = await client.get(self.arxiv_base, params=params)
                if resp.status_code != 200:
                    return []

                # Parse Atom XML
                root = ET.fromstring(resp.text)
                ns = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
                results = []

                for entry in root.findall(".//atom:entry", ns):
                    title_elem = entry.find("atom:title", ns)
                    title = title_elem.text.strip() if title_elem is not None else ""

                    authors = []
                    for author in entry.findall("atom:author", ns):
                        name_elem = author.find("atom:name", ns)
                        if name_elem is not None and name_elem.text:
                            authors.append(name_elem.text)

                    published_elem = entry.find("atom:published", ns)
                    pubdate = published_elem.text[:10] if published_elem is not None else ""

                    doi_elem = entry.find("arxiv:doi", ns)
                    doi = doi_elem.text if doi_elem is not None else ""

                    # arXiv ID as source
                    id_elem = entry.find("atom:id", ns)
                    source = f"arXiv:{id_elem.text.split('/')[-1] if id_elem is not None else 'preprint'}"

                    if title:
                        citation = self._format_citation(authors, title, source, pubdate, doi, style="apa")
                        citation["database"] = "arXiv"
                        if id_elem is not None and id_elem.text:
                            citation["link"] = id_elem.text.replace("http://", "https://")
                        results.append(citation)

                return results
            except Exception as e:
                print(f"arXiv search error: {e}")
                return []

    async def _search_openalex(self, query: str, max_results: int = 5) -> List[dict]:
        """Search OpenAlex works."""
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            try:
                effective_query = await self._build_plain_english_query(query)
                params = {
                    "search": effective_query,
                    "per-page": max_results,
                    "select": "id,doi,title,publication_year,authorships,primary_location",
                }
                resp = await client.get(self.openalex_base, params=params)
                if resp.status_code != 200:
                    print(f"OpenAlex search error: HTTP {resp.status_code}")
                    return []

                results = []
                for item in resp.json().get("results", [])[:max_results]:
                    title = item.get("title", "") or ""
                    authors = [
                        authorship.get("author", {}).get("display_name", "")
                        for authorship in item.get("authorships", [])
                        if isinstance(authorship, dict) and authorship.get("author", {}).get("display_name")
                    ]
                    primary_location = item.get("primary_location") or {}
                    source_info = primary_location.get("source") or {}
                    source = (
                        source_info.get("display_name")
                        or primary_location.get("raw_source_name")
                        or "OpenAlex"
                    )
                    year = str(item.get("publication_year") or "")
                    doi = (item.get("doi") or "").replace("https://doi.org/", "")
                    link = primary_location.get("landing_page_url") or item.get("doi") or item.get("id") or ""

                    if title:
                        citation = self._format_citation(authors, title, source, year, doi, style="apa")
                        citation["database"] = "OpenAlex"
                        citation["link"] = link
                        if item.get("id"):
                            citation["openalex_id"] = item["id"]
                        results.append(citation)

                return results
            except Exception as e:
                print(f"OpenAlex search error: {e}")
                return []

    def _deduplicate_citations(self, citations: List[dict]) -> List[dict]:
        """Remove duplicate citations based on title similarity"""
        seen_titles = set()
        unique = []
        for cit in citations:
            title_lower = cit["title"].lower().strip()
            if title_lower not in seen_titles:
                seen_titles.add(title_lower)
                unique.append(cit)
        return unique

    async def search_literature(self, query: str, max_results: int = 10, databases: List[str] = None) -> List[dict]:
        """
        Search multiple academic databases for real literature.

        Args:
            query: Search query
            max_results: Maximum number of results to return
            databases: List of databases to search. Default: ["pubmed", "europepmc", "crossref"]

        Returns:
            List of citation dictionaries with full metadata
        """
        if databases is None:
            databases = ["pubmed", "europepmc", "crossref"]

        # Check cache
        cache_key = f"{query}:{max_results}:{','.join(databases)}"
        import time
        current_time = time.time()

        if cache_key in self.cache:
            cached = self.cache[cache_key]
            if current_time - cached["timestamp"] < self.cache_ttl:
                print(f"Using cached results for: {query}")
                return cached["citations"][:max_results]

        all_citations = []
        adapters = self._search_adapters()
        search_tasks = [
            adapters[database](query, max_results)
            for database in databases
            if database in adapters
        ]

        # Run searches concurrently
        if search_tasks:
            results = await asyncio.gather(*search_tasks, return_exceptions=True)
            for result in results:
                if isinstance(result, list):
                    all_citations.extend(result)

        # Deduplicate
        unique_citations = self._deduplicate_citations(all_citations)

        # Sort by relevance (PubMed first, then others)
        priority = {"PubMed": 0, "Europe PMC": 1, "CrossRef": 2, "arXiv": 3, "OpenAlex": 4}
        unique_citations.sort(key=lambda x: priority.get(x["database"], 4))

        # Cache positive results only. Empty responses are often caused by
        # transient upstream/API issues and should not mask later retries.
        if unique_citations:
            self.cache[cache_key] = {
                "citations": unique_citations,
                "timestamp": current_time
            }

        return unique_citations[:max_results]

    def get_citation_context(self, citations: List[dict], include_instruction: bool = True) -> str:
        """
        Generate a formatted citation context for AI prompts.

        Args:
            citations: List of citation dictionaries
            include_instruction: Whether to include usage instructions

        Returns:
            Formatted string with citations
        """
        if not citations:
            return ""

        context_parts = []

        if include_instruction:
            context_parts.append("【重要：真实学术参考文献】")
            context_parts.append("以下是从真实学术数据库中检索到的可验证文献。请在论文中引用这些文献，使用 (Author et al., Year) 格式进行文内引用，并在参考文献列表中完整列出。")
            context_parts.append("")

        context_parts.append("【参考文献列表】")
        for i, cit in enumerate(citations, 1):
            context_parts.append(f"[{i}] {cit['formatted']}")

        return "\n".join(context_parts)

    def validate_references(self, text: str, citations: List[dict]) -> dict:
        """
        Validate that references in the text match the provided citation list.

        Args:
            text: The full text of the thesis/paper
            citations: List of citation dictionaries that should be referenced

        Returns:
            Dictionary with validation results
        """
        import re

        # Extract all in-text citations (Author, Year) or (Author et al., Year) patterns
        citation_pattern = r'\(([A-Za-z一-鿿]+(?:\s+et\s+al\.|\s+等)?(?:\s+and\s+[A-Za-z一-鿿]+)*,\s*\d{4})\)'
        found_citations = re.findall(citation_pattern, text, re.IGNORECASE)

        # Extract reference list at the end
        ref_pattern = r'(?:参考文献|References|References\s*\d*)\s*[:：]?\s*\n([\s\S]*?)(?:\n\n|\Z)'
        ref_match = re.search(ref_pattern, text, re.IGNORECASE)
        ref_section = ref_match.group(1) if ref_match else ""

        # Check which provided citations are actually used
        used_citations = []
        unused_citations = []

        for cit in citations:
            authors = cit.get('authors', [])
            year = cit.get('year', '')
            title = cit.get('title', '')

            if not authors or not year:
                continue

            first_author = authors[0].split()[-1] if authors[0] else ""  # Get last name

            # Check if this citation appears in the text
            author_year_pattern = f"{first_author}.*{year}"
            is_used = bool(re.search(author_year_pattern, text, re.IGNORECASE))

            if is_used:
                used_citations.append(cit)
            else:
                unused_citations.append(cit)

        return {
            "total_provided": len(citations),
            "total_used": len(used_citations),
            "total_unused": len(unused_citations),
            "used_citations": used_citations,
            "unused_citations": unused_citations,
            "in_text_citations_found": found_citations,
            "has_reference_section": bool(ref_section),
            "reference_section_length": len(ref_section)
        }
