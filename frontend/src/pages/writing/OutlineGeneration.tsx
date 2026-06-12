// @ts-nocheck
import { useState, useEffect, type FC, useCallback } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Tag,
  message,
  Descriptions,
  Collapse,
  Modal,
  Input,
  Upload,
  Empty,
  Spin,
  Select,
} from 'antd';
import {
  FileTextOutlined,
  EditOutlined,
  SaveOutlined,
  DownloadOutlined,
  ArrowRightOutlined,
  UploadOutlined,
  BulbOutlined,
  FilePdfOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ThesisProject, ThesisStep, ThesisOutlineRequest } from '../../types/thesis';
import {
  getProjectSteps,
  generateOutline,
  saveOutline,
  exportOutline,
  getProjectReferences,
  saveUploadedReferences,
} from '../../services/thesisApi';
import { THESIS_TYPES, LENGTH_OPTIONS, LANGUAGES, DISCIPLINES } from '../../config/constants';
import ReferenceUpload, { type VerifiedReference } from './ReferenceUpload';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getLiteratureDatabaseOptions, searchLiterature } from '../../services/literatureApi';
import type { LiteratureDatabaseOption } from '../../types/literature';

const { Text, Paragraph } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface OutlineGenerationProps {
  project: ThesisProject;
  serviceToken: string;
  onOutlineConfirmed: (outline: string, steps: ThesisStep[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function findLabel<T extends { value: string; label: string }>(
  options: T[],
  value: string,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function hasReferenceBody(ref: any): boolean {
  return Boolean(String(ref?.raw_text || '').trim());
}

function _referenceDedupKey(ref: any): string {
  const doi = String(ref?.doi || '').trim().toLowerCase();
  if (doi) return `doi:${doi}`;
  return `title:${String(ref?.title || '').trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

async function confirmMissingReferenceBodies(
  projectId: number,
  serviceToken: string,
  databases: string[],
  actionName: string,
): Promise<boolean> {
  const data = await getProjectReferences(projectId, serviceToken, databases);
  const refs = [...(data.uploaded || []), ...(data.retrieved || [])];
  const missing = refs.filter((ref: any) => !hasReferenceBody(ref));
  if (missing.length === 0) return true;

  return new Promise((resolve) => {
    Modal.confirm({
      title: `存在 ${missing.length} 篇参考文献没有正文`,
      content: `这些文献只有题名、摘要或元数据，${actionName}时可能无法基于原文细节进行可靠引用。建议先在参考文献列表中补充正文。是否仍然继续？`,
      okText: '继续生成',
      cancelText: '返回补充正文',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

function parseMarkdownOutline(markdown: string): { sections: OutlineSection[] } {
  const lines = markdown.split('\n');
  const sections: OutlineSection[] = [];
  let currentSection: OutlineSection | null = null;
  let currentH2: OutlineSection | null = null;
  let contentBuffer: string[] = [];

  const flushContent = (target: OutlineSection) => {
    const text = contentBuffer.join('\n').trim();
    if (text) target.content = text;
    contentBuffer = [];
  };

  for (const line of lines) {
    const h1Match = line.match(/^#\s+(.+)/);
    const h2Match = line.match(/^##\s+(.+)/);
    const h3Match = line.match(/^###\s+(.+)/);

    if (h1Match) {
      // Flush pending content to previous h2 or h1
      if (currentH2) { flushContent(currentH2); currentH2 = null; }
      else if (currentSection) flushContent(currentSection);

      currentSection = {
        key: `sec-${sections.length}`,
        title: h1Match[1].trim(),
        level: 1,
        children: [],
        content: '',
      };
      sections.push(currentSection);
    } else if (h2Match) {
      // Flush to previous h2
      if (currentH2) { flushContent(currentH2); }

      const child: OutlineSection = {
        key: `h2-${currentSection?.children.length ?? 0}`,
        title: h2Match[1].trim(),
        level: 2,
        children: [],
        content: '',
      };
      if (currentSection) {
        currentSection.children.push(child);
        currentH2 = child;
      } else {
        // h2 without h1 — treat as top-level
        currentSection = {
          key: `sec-${sections.length}`,
          title: child.title,
          level: 1,
          children: [],
          content: '',
        };
        sections.push(currentSection);
        currentH2 = null;
      }
    } else if (h3Match) {
      if (currentH2) flushContent(currentH2);
      const sub: OutlineSection = {
        key: `h3-${currentH2?.children.length ?? 0}`,
        title: h3Match[1].trim(),
        level: 3,
        children: [],
        content: '',
      };
      if (currentH2) {
        currentH2.children.push(sub);
      } else if (currentSection) {
        currentSection.children.push(sub);
      }
      currentH2 = null;
    } else {
      // Content line — append to buffer
      contentBuffer.push(line);
    }
  }

  // Flush remaining
  if (currentH2) flushContent(currentH2);
  else if (currentSection) flushContent(currentSection);

  return { sections };
}

interface OutlineSection {
  key: string;
  title: string;
  level: number;
  children: OutlineSection[];
  content: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const OutlineGeneration: FC<OutlineGenerationProps> = ({
  project,
  serviceToken,
  onOutlineConfirmed,
}) => {
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<ThesisStep[]>([]);
  const [outlineContent, setOutlineContent] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [referencesUploaded, setReferencesUploaded] = useState(false);
  const [verifiedRefs, setVerifiedRefs] = useState<VerifiedReference[]>([]);
  const [referencesRefreshKey, setReferencesRefreshKey] = useState(0);
  const [styleFile, setStyleFile] = useState<File | null>(null);
  const [literatureDatabases, setLiteratureDatabases] = useState<LiteratureDatabaseOption[]>([]);
  const [selectedDatabases, setSelectedDatabases] = useState<string[]>([]);

  // -------------------------------------------------------------------------
  // Load project steps
  // -------------------------------------------------------------------------
  const loadSteps = useCallback(async (): Promise<void> => {
    if (!project.id) return;
    setLoading(true);
    try {
      const data = await getProjectSteps(project.id, serviceToken);
      setSteps(data);

      // Find outline step (step_num=1)
      const outlineStep = data.find((s: any) => s.step_num === 1);
      if (outlineStep?.content) {
        setOutlineContent(outlineStep.content);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载项目步骤失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [project.id, serviceToken]);

  useEffect(() => {
    loadSteps();
  }, [loadSteps]);

  useEffect(() => {
    if (!serviceToken) return;
    getLiteratureDatabaseOptions(serviceToken, 'writing')
      .then(data => {
        setLiteratureDatabases(data.databases);
        setSelectedDatabases(data.defaults);
      })
      .catch(() => {});
  }, [serviceToken]);

  // -------------------------------------------------------------------------
  // Generate outline
  // -------------------------------------------------------------------------
  const handleGenerateOutline = async (): Promise<void> => {
    setGenerating(true);
    try {
      const shouldContinue = await confirmMissingReferenceBodies(
        project.id,
        serviceToken,
        selectedDatabases,
        '生成提纲',
      );
      if (!shouldContinue) return;

      const request: ThesisOutlineRequest = {
        project_id: project.id,
        token: serviceToken,
        databases: selectedDatabases,
      };

      const result = await generateOutline(request);
      setOutlineContent(result.outline);
      message.success('提纲生成成功！请检查并确认');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成提纲失败';
      message.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  // -------------------------------------------------------------------------
  // Save outline
  // -------------------------------------------------------------------------
  const handleSaveOutline = async (): Promise<void> => {
    setSaving(true);
    try {
      await saveOutline({
        project_id: project.id,
        token: serviceToken,
        outline: editText || outlineContent,
      });
      setOutlineContent(editText || outlineContent);
      setEditing(false);
      message.success('提纲已保存');
      await loadSteps();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存提纲失败';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Export outline
  // -------------------------------------------------------------------------
  const handleExportOutline = async (): Promise<void> => {
    setExporting(true);
    try {
      const blob = await exportOutline({
        project_id: project.id,
        token: serviceToken,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `提纲_${project.title ?? '未命名'}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('提纲已导出');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '导出失败';
      message.error(msg);
    } finally {
      setExporting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Confirm outline and proceed
  // -------------------------------------------------------------------------
  const handleConfirm = (): void => {
    if (!outlineContent) {
      message.warning('请先生成或编辑提纲');
      return;
    }
    onOutlineConfirmed(outlineContent, steps);
  };

  // -------------------------------------------------------------------------
  // Edit
  // -------------------------------------------------------------------------
  const handleStartEdit = (): void => {
    setEditText(outlineContent);
    setEditing(true);
  };

  // -------------------------------------------------------------------------
  // Render outline as collapsible cards
  // -------------------------------------------------------------------------
  const renderOutlineContent = (): React.ReactNode => {
    if (!outlineContent) {
      return <Empty description="暂无提纲，请点击生成按钮" />;
    }

    const { sections } = parseMarkdownOutline(outlineContent);

    if (sections.length === 0) {
      return (
        <pre style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, background: '#fafafa', padding: 16, borderRadius: 8 }}>
          {outlineContent}
        </pre>
      );
    }

    // First section is the paper title — display as a header, not a collapsible panel
    const [titleSection, ...bodySections] = sections;

    return (
      <div>
        {/* Paper title — standalone header */}
        <div style={{ textAlign: 'center', marginBottom: 20, padding: '16px 0', borderBottom: '2px solid #1a1a2e' }}>
          <Text strong style={{ fontSize: 18, color: '#1a1a2e' }}>{titleSection.title}</Text>
          {titleSection.content && (
            <Paragraph style={{ whiteSpace: 'pre-wrap', color: '#666', marginTop: 8, fontSize: 14 }}>
              {titleSection.content}
            </Paragraph>
          )}
        </div>

        {/* Body sections — collapsible panels */}
        {bodySections.length > 0 && (
          <Collapse
            size="small"
            defaultActiveKey={bodySections.map(s => s.key)}
            items={bodySections.map((section) => ({
              key: section.key,
              label: (
                <Space>
                  <Text strong>{section.title}</Text>
                  {section.children.length > 0 && (
                    <Tag>{section.children.length} 小节</Tag>
                  )}
                </Space>
              ),
              children: (
                <div>
                  {section.content && (
                    <Paragraph style={{ whiteSpace: 'pre-wrap', color: '#555', marginBottom: 16, lineHeight: 1.8 }}>
                      {section.content}
                    </Paragraph>
                  )}
                  {section.children.map((child) => (
                    <Card key={child.key} size="small" style={{ marginBottom: 8 }}
                      title={<Text style={{ fontSize: 13 }}>{child.title}</Text>}
                    >
                      {child.content && (
                        <Paragraph style={{ whiteSpace: 'pre-wrap', color: '#555', marginBottom: 12, lineHeight: 1.7, fontSize: 13 }}>
                          {child.content}
                        </Paragraph>
                      )}
                      {child.children.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {child.children.map((sub) => (
                            <li key={sub.key} style={{ marginBottom: 6 }}>
                              <Text strong style={{ fontSize: 13 }}>{sub.title}</Text>
                              {sub.content && (
                                <div style={{ whiteSpace: 'pre-wrap', color: '#777', fontSize: 12, marginTop: 2 }}>
                                  {sub.content}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  ))}
                </div>
              ),
            }))}
          />
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return <LoadingSpinner tip="加载项目信息..." />;
  }

  const disciplineLabel = findLabel(DISCIPLINES, project.discipline);
  const thesisTypeLabel = findLabel(THESIS_TYPES, project.thesis_type);
  const languageLabel = findLabel(LANGUAGES, project.language);
  const lengthLabel = findLabel(LENGTH_OPTIONS, project.length);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* ---- Project Info ---- */}
      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>项目信息</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Descriptions column={{ xs: 1, sm: 2, md: 4 }} size="small" bordered>
          <Descriptions.Item label="课题">
            {project.title ?? '未设定'}
          </Descriptions.Item>
          <Descriptions.Item label="学科">
            <Tag color="blue">{disciplineLabel}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="类型">
            <Tag>{thesisTypeLabel}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="语言">
            <Tag>{languageLabel}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="篇幅">{lengthLabel}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color="processing">{project.status ?? '进行中'}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* ---- Reference Upload ---- */}
      <ReferenceUpload
        serviceToken={serviceToken}
        projectId={project.id}
        onReferencesVerified={(refs) => {
          setVerifiedRefs(refs);
          setReferencesUploaded(true);
          setReferencesRefreshKey((key) => key + 1);
        }}
      />

      {/* ---- References List (uploaded + retrieved) ---- */}
      <ReferencesListCard
        projectId={project.id}
        projectTopic={project.topic}
        serviceToken={serviceToken}
        selectedDatabases={selectedDatabases}
        literatureDatabases={literatureDatabases}
        onSelectedDatabasesChange={setSelectedDatabases}
        refreshKey={referencesRefreshKey}
      />

      {/* ---- Style Reference Upload ---- */}
      <Card
        title={
          <Space>
            <FilePdfOutlined />
            <span>上传范文（可选）</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Upload
          maxCount={3}
          accept=".pdf,.docx,.doc"
          beforeUpload={(file) => {
            setStyleFile(file);
            message.info(`已选择范文：${file.name}`);
            return false;
          }}
          onRemove={() => setStyleFile(null)}
        >
          <Button icon={<UploadOutlined />}>选择范文</Button>
        </Upload>
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          上传范文以参考其写作风格（最多3个文件）
        </Text>
      </Card>

      {/* ---- Outline Section ---- */}
      <Card
        title={
          <Space>
            <BulbOutlined style={{ color: '#faad14' }} />
            <span>论文提纲</span>
          </Space>
        }
        extra={
          outlineContent ? (
            <Space>
              <Button
                size="small"
                icon={<BulbOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: '重新生成提纲？',
                    content: '重新生成会覆盖当前页面中的提纲内容，建议先保存已有提纲。',
                    okText: '重新生成',
                    cancelText: '取消',
                    onOk: () => {
                      void handleGenerateOutline();
                    },
                  });
                }}
                loading={generating}
              >
                重新生成
              </Button>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={handleStartEdit}
              >
                编辑
              </Button>
              <Button
                size="small"
                icon={<SaveOutlined />}
                onClick={handleSaveOutline}
                loading={saving}
              >
                保存提纲
              </Button>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={handleExportOutline}
                loading={exporting}
              >
                导出 Word
              </Button>
            </Space>
          ) : undefined
        }
        style={{ marginBottom: 24 }}
      >
        {generating ? (
          <LoadingSpinner
            tip="正在生成论文提纲"
            description="系统正在读取项目资料、参考文献和写作要求，生成完成后会自动替换当前提纲。"
            steps={[
              '整理项目主题与论文类型',
              '检查参考文献正文完整性',
              '生成章节结构与研究要点',
            ]}
          />
        ) : outlineContent ? (
          renderOutlineContent()
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Empty description="暂无提纲">
              <Button
                type="primary"
                size="large"
                icon={<BulbOutlined />}
                onClick={handleGenerateOutline}
                loading={generating}
              >
                生成提纲
              </Button>
            </Empty>
          </div>
        )}
      </Card>

      {/* ---- Confirm Button ---- */}
      {outlineContent && (
        <div style={{ textAlign: 'center', marginTop: 24, marginBottom: 24 }}>
          <Button
            type="primary"
            size="large"
            icon={<ArrowRightOutlined />}
            onClick={handleConfirm}
          >
            确认提纲，生成全文
          </Button>
        </div>
      )}

      {/* ---- Edit Modal ---- */}
      <Modal
        title={
          <Space>
            <EditOutlined />
            <span>编辑提纲</span>
          </Space>
        }
        open={editing}
        onCancel={() => setEditing(false)}
        onOk={handleSaveOutline}
        okText="保存"
        cancelText="取消"
        width="80%"
        style={{ top: 24 }}
        confirmLoading={saving}
        destroyOnClose
      >
        <Input.TextArea
          rows={25}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: 13 }}
          placeholder="使用 Markdown 格式编辑提纲。例如：
# 第一章 绪论
## 1.1 研究背景
## 1.2 研究意义
# 第二章 文献综述
..."
        />
      </Modal>
    </div>
  );
};

// =========================================================================
// ReferencesListCard — show user-uploaded + auto-retrieved references
// =========================================================================
import { List, Badge } from 'antd';
import { LinkOutlined, UploadOutlined as UplIcon, SearchOutlined as SearchIcon } from '@ant-design/icons';
function ReferencesListCard({
  projectId,
  projectTopic,
  serviceToken,
  selectedDatabases,
  literatureDatabases,
  onSelectedDatabasesChange,
  refreshKey,
}: {
  projectId: number;
  projectTopic: string;
  serviceToken: string;
  selectedDatabases: string[];
  literatureDatabases: LiteratureDatabaseOption[];
  onSelectedDatabasesChange: (databases: string[]) => void;
  refreshKey: number;
}) {
  const [refs, setRefs] = useState<{ uploaded: any[]; retrieved: any[] }>({ uploaded: [], retrieved: [] });
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState(projectTopic || '');
  const [candidateResults, setCandidateResults] = useState<any[]>([]);
  const [selectedCandidateKeys, setSelectedCandidateKeys] = useState<string[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [hiddenRefKeys, setHiddenRefKeys] = useState<string[]>([]);
  const [bodyViewer, setBodyViewer] = useState<any | null>(null);
  const [supplementRef, setSupplementRef] = useState<any | null>(null);
  const [supplementText, setSupplementText] = useState('');
  const [editingRef, setEditingRef] = useState<any | null>(null);
  const [editRefDraft, setEditRefDraft] = useState<any>({});
  const [savingBody, setSavingBody] = useState(false);

  const loadRefs = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    getProjectReferences(projectId, serviceToken, [])
      .then(d => { setRefs({ uploaded: d.uploaded || [], retrieved: [] }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId, serviceToken]);

  useEffect(() => {
    loadRefs();
  }, [projectId, serviceToken, refreshKey]);

  useEffect(() => {
    setSearchQuery(projectTopic || '');
  }, [projectTopic]);

  const mapSearchResultToReference = (item: any) => ({
    title: item.title || '',
    authors: item.authors || '',
    year: item.year || null,
    source: item.source || item.journal || item.database || '',
    journal: item.journal || item.source || '',
    database: item.database || item.source_database || '',
    doi: item.doi || '',
    link: item.link || item.url || (item.doi ? `https://doi.org/${item.doi}` : ''),
    abstract_preview: item.abstract || item.abstract_preview || '',
    formatted: item.formatted || '',
  });

  const handleSearchReferences = async (value?: string) => {
    const query = String(value ?? searchQuery ?? '').trim();
    if (!query) {
      message.warning('请输入要检索的关键词');
      return;
    }
    setSearching(true);
    try {
      const data = await searchLiterature(query, 20, selectedDatabases, serviceToken);
      const nextResults = (data.results || [])
        .map(mapSearchResultToReference)
        .filter((ref: any) => _referenceDedupKey(ref) !== 'title:');
      setCandidateResults(nextResults);
      setSelectedCandidateKeys([]);
      message.success(`已检索到 ${nextResults.length} 篇候选文献，请选择后入库`);
    } catch (err: any) {
      message.error(err?.message || '文献检索失败');
    } finally {
      setSearching(false);
    }
  };

  const uploadedRefs = refs.uploaded.map((r: any, i: number) => ({
    ...r,
    _source: r.import_source === 'literature_search' ? 'searched' : 'uploaded',
    _key: `up-${i}`,
  }));
  const uploadedKeys = new Set(uploadedRefs.map((ref: any) => _referenceDedupKey(ref)));
  const allRefs = [...uploadedRefs];
  const visibleRefs = allRefs.filter((ref: any) => !hiddenRefKeys.includes(_referenceDedupKey(ref)));
  const selectableCandidates = candidateResults.filter((ref: any) => !uploadedKeys.has(_referenceDedupKey(ref)));
  const selectedCandidateRefs = selectableCandidates.filter((ref: any) => selectedCandidateKeys.includes(_referenceDedupKey(ref)));

  const makeContentExcerpt = (value: string) => {
    const text = value.replace(/\s+/g, ' ').trim();
    if (text.length <= 1800) return text;
    return `${text.slice(0, 900)}\n...[中间内容已省略]...\n${text.slice(-900)}`;
  };

  const cleanReferenceForSave = (ref: any, rawText: string) => {
    const { _source, _key, ...rest } = ref;
    return {
      ...rest,
      raw_text: rawText,
      raw_text_length: rawText.length,
      content_excerpt: makeContentExcerpt(rawText),
    };
  };

  const handleSaveSupplement = async () => {
    const rawText = supplementText.trim();
    if (!supplementRef || rawText.length < 100) {
      message.warning('正文内容太短，请至少补充 100 个字符');
      return;
    }
    setSavingBody(true);
    try {
      await saveUploadedReferences(projectId, {
        token: serviceToken,
        references: [cleanReferenceForSave(supplementRef, rawText)],
      });
      setHiddenRefKeys((prev) => prev.filter((key) => key !== _referenceDedupKey(supplementRef)));
      message.success('正文已补充并保存');
      setSupplementRef(null);
      setSupplementText('');
      loadRefs();
    } catch (err: any) {
      message.error(err?.message || '保存正文失败');
    } finally {
      setSavingBody(false);
    }
  };

  const handleReplaceUploadedRefs = async (nextRefs: any[]) => {
    await saveUploadedReferences(projectId, {
      token: serviceToken,
      references: nextRefs,
      replace: true,
    });
    loadRefs();
  };

  const handleToggleCandidate = (ref: any) => {
    const key = _referenceDedupKey(ref);
    setSelectedCandidateKeys((prev) => (
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    ));
  };

  const handleAddCandidatesToLibrary = async () => {
    if (selectedCandidateRefs.length === 0) {
      message.warning('请先选择要入库的检索文献');
      return;
    }
    setSavingBody(true);
    try {
      await saveUploadedReferences(projectId, {
        token: serviceToken,
        references: selectedCandidateRefs.map((ref: any) => ({
          ...ref,
          import_source: 'literature_search',
        })),
      });
      message.success(`已入库 ${selectedCandidateRefs.length} 篇文献`);
      setSelectedCandidateKeys([]);
      setCandidateResults((prev) => prev.filter((ref: any) => !selectedCandidateKeys.includes(_referenceDedupKey(ref))));
      loadRefs();
    } catch (err: any) {
      message.error(err?.message || '文献入库失败');
    } finally {
      setSavingBody(false);
    }
  };

  const handleSaveReferenceEdit = async () => {
    if (!editingRef) return;
    setSavingBody(true);
    try {
      const key = _referenceDedupKey(editingRef);
      if (editingRef._source === 'uploaded' || editingRef._source === 'searched') {
        const nextUploaded = refs.uploaded.map((ref: any) => (
          _referenceDedupKey(ref) === key ? { ...ref, ...editRefDraft } : ref
        ));
        await handleReplaceUploadedRefs(nextUploaded);
      } else {
        const { _source, _key, ...savedRef } = editingRef;
        await saveUploadedReferences(projectId, {
          token: serviceToken,
          references: [{ ...savedRef, ...editRefDraft }],
        });
        loadRefs();
      }
      setHiddenRefKeys((prev) => prev.filter((item) => item !== key));
      message.success('文献已更新');
      setEditingRef(null);
      setEditRefDraft({});
    } catch (err: any) {
      message.error(err?.message || '更新文献失败');
    } finally {
      setSavingBody(false);
    }
  };

  const handleDeleteReference = async (ref: any) => {
    setSavingBody(true);
    try {
      const key = _referenceDedupKey(ref);
      if (ref._source === 'uploaded' || ref._source === 'searched') {
        const nextUploaded = refs.uploaded.filter((item: any) => _referenceDedupKey(item) !== key);
        await handleReplaceUploadedRefs(nextUploaded);
      } else {
        setHiddenRefKeys((prev) => Array.from(new Set([...prev, key])));
      }
      if (expandedKey === ref._key) setExpandedKey(null);
      message.success('文献已删除');
    } catch (err: any) {
      message.error(err?.message || '删除文献失败');
    } finally {
      setSavingBody(false);
    }
  };

  const openReferenceEdit = (ref: any) => {
    setEditingRef(ref);
    setEditRefDraft({
      title: ref.title || '',
      authors: Array.isArray(ref.authors) ? ref.authors.join(', ') : (ref.authors || ''),
      year: ref.year || '',
      source: ref.source || '',
      journal: ref.journal || '',
      doi: ref.doi || '',
      abstract_preview: ref.abstract_preview || '',
    });
  };

  const title = (
    <Space>
      <span>参考文献</span>
      <Tag>{visibleRefs.length} 篇</Tag>
    </Space>
  );

  if (loading) return <Card size="small" title={title} style={{ marginBottom: 16 }}><Spin size="small" /></Card>;

  return (
    <Card
      size="small"
      title={title}
      style={{ marginBottom: 16 }}
      styles={{ body: { padding: 0 } }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fff',
        }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text strong>文献检索</Text>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(260px, 420px) auto', gap: 12, alignItems: 'end' }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>检索关键词</Text>
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onPressEnter={() => handleSearchReferences()}
                placeholder="输入题名、关键词或研究方向"
                allowClear
              />
            </Space>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>来源库</Text>
              <Select
                mode="multiple"
                allowClear
                maxTagCount="responsive"
                value={selectedDatabases}
                onChange={onSelectedDatabasesChange}
                placeholder="选择要检索的文献库"
                style={{ width: '100%' }}
                optionFilterProp="label"
                options={literatureDatabases.map((db) => ({
                  label: db.description ? `${db.name} - ${db.description}` : db.name,
                  value: db.key,
                }))}
              />
            </Space>
            <Button
              type="primary"
              icon={<SearchIcon />}
              loading={searching}
              onClick={() => handleSearchReferences()}
            >
              检索
            </Button>
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            选择来源库不会自动检索；点击“检索”后先进入候选结果，勾选并入库后才会加入下方参考文献列表。
          </Text>
        </Space>
      </div>
      {candidateResults.length > 0 && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Text strong>候选结果</Text>
                <Tag>{selectableCandidates.length} 篇可入库</Tag>
                {selectedCandidateRefs.length > 0 && <Tag color="blue">已选 {selectedCandidateRefs.length} 篇</Tag>}
              </Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                disabled={selectedCandidateRefs.length === 0}
                loading={savingBody}
                onClick={handleAddCandidatesToLibrary}
              >
                入库
              </Button>
            </Space>
            <List
              size="small"
              dataSource={candidateResults}
              renderItem={(ref: any) => {
                const key = _referenceDedupKey(ref);
                const selected = selectedCandidateKeys.includes(key);
                const alreadySaved = uploadedKeys.has(key);
                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 0',
                      borderTop: '1px solid #f0f0f0',
                    }}
                  >
                    <Button
                      size="small"
                      type={selected ? 'primary' : 'default'}
                      disabled={alreadySaved}
                      onClick={() => handleToggleCandidate(ref)}
                    >
                      {alreadySaved ? '已入库' : selected ? '已选择' : '选择'}
                    </Button>
                    <Text style={{ flex: 1, fontSize: 13 }} ellipsis={{ tooltip: ref.title }}>
                      {ref.title}
                    </Text>
                    {ref.year && <Text type="secondary" style={{ width: 56 }}>{ref.year}</Text>}
                    <Tag>{ref.database || ref.source || '检索'}</Tag>
                    {ref.doi && (
                      <a href={`https://doi.org/${ref.doi}`} target="_blank" rel="noreferrer">
                        <LinkOutlined />
                      </a>
                    )}
                  </div>
                );
              }}
            />
          </Space>
        </div>
      )}
      {visibleRefs.length > 0 && (
        <div style={{ padding: '10px 20px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
          <Text strong>已入库参考文献</Text>
        </div>
      )}
      {visibleRefs.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无参考文献" style={{ padding: 16 }} />
      )}
      <List
        size="small"
        dataSource={visibleRefs}
        renderItem={(ref: any) => {
          const isExpanded = expandedKey === ref._key;
          const isUploaded = ref._source === 'uploaded';
          const isSearched = ref._source === 'searched';
          return (
            <div key={ref._key} style={{ borderBottom: '1px solid #f0f0f0' }}>
              {/* Title row — always visible */}
              <div
                onClick={() => setExpandedKey(isExpanded ? null : ref._key)}
                style={{
                  padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  background: isExpanded ? '#fafafa' : 'transparent',
                  transition: 'background 0.2s',
                }}
              >
                <Badge status={isUploaded ? 'processing' : isSearched ? 'success' : 'default'}
                  title={isUploaded ? '用户上传' : isSearched ? '检索入库' : '系统检索'} />
                <Text style={{ flex: 1, fontSize: 13 }}
                  ellipsis={{ tooltip: ref.title || ref.formatted }}>
                  {ref.title || (ref.formatted || '').substring(0, 80) + '...'}
                </Text>
                <Tag color={isUploaded ? 'blue' : isSearched ? 'green' : 'default'} icon={isUploaded ? <UplIcon /> : <SearchIcon />}>
                  {isUploaded ? '上传' : isSearched ? '检索入库' : '检索'}
                </Tag>
                {ref.doi && (
                  <a href={`https://doi.org/${ref.doi}`} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: 12 }}><LinkOutlined /></a>
                )}
                {ref.link && !ref.doi && (
                  <a href={ref.link} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: 12 }}><LinkOutlined /></a>
                )}
                <Button
                  size="small"
                  type="link"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedKey(isExpanded ? null : ref._key);
                  }}
                >
                  详情
                </Button>
                <Button
                  size="small"
                  type="link"
                  danger
                  onClick={(e) => {
                    e.stopPropagation();
                    Modal.confirm({
                      title: '删除这篇文献？',
                      content: isUploaded || isSearched
                        ? '删除后该文献不会再参与提纲和全文生成。'
                        : '该检索文献会从当前参考文献列表中移除。',
                      okText: '删除',
                      cancelText: '取消',
                      okButtonProps: { danger: true },
                      onOk: () => handleDeleteReference(ref),
                    });
                  }}
                >
                  删除
                </Button>
              </div>
              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ padding: '12px 16px 16px 40px', background: '#fafafa' }}>
                  <Space style={{ marginBottom: 12 }} wrap>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openReferenceEdit(ref)}
                    >
                      编辑信息
                    </Button>
                    {hasReferenceBody(ref) ? (
                      <Button
                        size="small"
                        onClick={() => setBodyViewer(ref)}
                      >
                        查看正文
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        type="primary"
                        ghost
                        onClick={() => {
                          setSupplementRef(ref);
                          setSupplementText('');
                        }}
                      >
                        补充正文
                      </Button>
                    )}
                  </Space>
                  <Descriptions column={1} size="small">
                    {ref.authors && (
                      <Descriptions.Item label="作者">
                        {Array.isArray(ref.authors) ? ref.authors.join(', ') : ref.authors}
                      </Descriptions.Item>
                    )}
                    {ref.year && <Descriptions.Item label="年份">{ref.year}</Descriptions.Item>}
                    {ref.source && <Descriptions.Item label="来源">{ref.source}</Descriptions.Item>}
                    {ref.journal && <Descriptions.Item label="期刊">{ref.journal}</Descriptions.Item>}
                    {ref.database && <Descriptions.Item label="数据库">{ref.database}</Descriptions.Item>}
                    {ref.verified !== undefined && (
                      <Descriptions.Item label="验证状态">
                        {ref.verified ? <Tag color="green">已通过</Tag>
                          : ref.skipped_verification ? <Tag color="orange">跳过验证</Tag>
                            : <Tag color="red">未验证</Tag>}
                      </Descriptions.Item>
                    )}
                    {ref.abstract_preview && (
                      <Descriptions.Item label="摘要">
                        <Paragraph style={{ fontSize: 12, margin: 0 }} ellipsis={{ rows: 4 }}>
                          {ref.abstract_preview}
                        </Paragraph>
                      </Descriptions.Item>
                    )}
                    {ref.similarity_score !== undefined && (
                      <Descriptions.Item label="匹配度">{ref.similarity_score}</Descriptions.Item>
                    )}
                    {ref.raw_text_length && (
                      <Descriptions.Item label="已存正文">
                        {Number(ref.raw_text_length).toLocaleString()} 字符
                      </Descriptions.Item>
                    )}
                    {ref.content_excerpt && (
                      <Descriptions.Item label="正文摘录">
                        <Paragraph style={{ fontSize: 12, margin: 0 }} ellipsis={{ rows: 4 }}>
                          {ref.content_excerpt}
                        </Paragraph>
                      </Descriptions.Item>
                    )}
                    {ref.formatted && (
                      <Descriptions.Item label="格式化引用">
                        <Text style={{ fontSize: 12 }}>{ref.formatted}</Text>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </div>
              )}
            </div>
          );
        }}
      />
      <Modal
        title={bodyViewer?.title || '文献正文'}
        open={Boolean(bodyViewer)}
        onCancel={() => setBodyViewer(null)}
        footer={<Button onClick={() => setBodyViewer(null)}>关闭</Button>}
        width="80%"
      >
        <Input.TextArea
          value={bodyViewer?.raw_text || ''}
          readOnly
          rows={24}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Modal>
      <Modal
        title={`补充正文：${supplementRef?.title || ''}`}
        open={Boolean(supplementRef)}
        onCancel={() => {
          setSupplementRef(null);
          setSupplementText('');
        }}
        onOk={handleSaveSupplement}
        okText="保存正文"
        cancelText="取消"
        confirmLoading={savingBody}
        width="80%"
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          请粘贴该文献的正文、全文摘录或可引用内容。保存后，生成提纲和正文时会优先基于这里的正文内容引用。
        </Text>
        <Input.TextArea
          value={supplementText}
          onChange={(e) => setSupplementText(e.target.value)}
          rows={22}
          placeholder="粘贴文献正文..."
        />
      </Modal>
      <Modal
        title="编辑文献信息"
        open={Boolean(editingRef)}
        onCancel={() => {
          setEditingRef(null);
          setEditRefDraft({});
        }}
        onOk={handleSaveReferenceEdit}
        okText="保存"
        cancelText="取消"
        confirmLoading={savingBody}
        width={720}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Input
            addonBefore="标题"
            value={editRefDraft.title}
            onChange={(e) => setEditRefDraft((prev: any) => ({ ...prev, title: e.target.value }))}
          />
          <Input
            addonBefore="作者"
            value={Array.isArray(editRefDraft.authors) ? editRefDraft.authors.join(', ') : editRefDraft.authors}
            onChange={(e) => setEditRefDraft((prev: any) => ({ ...prev, authors: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))}
          />
          <Input
            addonBefore="年份"
            value={editRefDraft.year}
            onChange={(e) => setEditRefDraft((prev: any) => ({ ...prev, year: e.target.value }))}
          />
          <Input
            addonBefore="来源"
            value={editRefDraft.source}
            onChange={(e) => setEditRefDraft((prev: any) => ({ ...prev, source: e.target.value }))}
          />
          <Input
            addonBefore="期刊"
            value={editRefDraft.journal}
            onChange={(e) => setEditRefDraft((prev: any) => ({ ...prev, journal: e.target.value }))}
          />
          <Input
            addonBefore="DOI"
            value={editRefDraft.doi}
            onChange={(e) => setEditRefDraft((prev: any) => ({ ...prev, doi: e.target.value }))}
          />
          <Input.TextArea
            rows={5}
            value={editRefDraft.abstract_preview}
            onChange={(e) => setEditRefDraft((prev: any) => ({ ...prev, abstract_preview: e.target.value }))}
            placeholder="摘要"
          />
        </Space>
      </Modal>
    </Card>
  );
}


export default OutlineGeneration;
