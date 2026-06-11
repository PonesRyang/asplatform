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
} from '@ant-design/icons';
import type { ThesisProject, ThesisStep, ThesisOutlineRequest } from '../../types/thesis';
import {
  getProjectSteps,
  generateOutline,
  saveOutline,
  exportOutline,
} from '../../services/thesisApi';
import { THESIS_TYPES, LENGTH_OPTIONS, LANGUAGES, DISCIPLINES } from '../../config/constants';
import ReferenceUpload, { type VerifiedReference } from './ReferenceUpload';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getLiteratureDatabaseOptions } from '../../services/literatureApi';
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
        }}
      />

      {/* ---- References List (uploaded + retrieved) ---- */}
      <ReferencesListCard
        projectId={project.id}
        serviceToken={serviceToken}
        literatureDatabases={literatureDatabases}
        selectedDatabases={selectedDatabases}
        onSelectedDatabasesChange={setSelectedDatabases}
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
          <LoadingSpinner tip="正在生成论文提纲，请耐心等待..." />
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
import { List, Badge, Tooltip } from 'antd';
import { LinkOutlined, UploadOutlined as UplIcon, SearchOutlined as SearchIcon } from '@ant-design/icons';
function ReferencesListCard({
  projectId,
  serviceToken,
  literatureDatabases,
  selectedDatabases,
  onSelectedDatabasesChange,
}: {
  projectId: number;
  serviceToken: string;
  literatureDatabases: LiteratureDatabaseOption[];
  selectedDatabases: string[];
  onSelectedDatabasesChange: (value: string[]) => void;
}) {
  const [refs, setRefs] = useState<{ uploaded: any[]; retrieved: any[] }>({ uploaded: [], retrieved: [] });
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    const params = new URLSearchParams({ token: serviceToken });
    if (selectedDatabases.length > 0) params.set('databases', selectedDatabases.join(','));
    fetch(`/api/ai/thesis/${projectId}/references?${params.toString()}`)
      .then(r => r.json())
      .then(d => { setRefs({ uploaded: d.uploaded || [], retrieved: d.retrieved || [] }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId, serviceToken, selectedDatabases]);

  const allRefs = [
    ...refs.uploaded.map((r: any, i: number) => ({ ...r, _source: 'uploaded', _key: `up-${i}` })),
    ...refs.retrieved.map((r: any, i: number) => ({ ...r, _source: 'retrieved', _key: `ret-${i}` })),
  ];

  const title = (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Space>参考文献 <Tag>{allRefs.length} 篇</Tag></Space>
      <Select
        mode="multiple"
        allowClear
        size="small"
        value={selectedDatabases}
        onChange={onSelectedDatabasesChange}
        options={literatureDatabases.map(item => ({
          label: item.name,
          value: item.key,
          title: item.description || item.name,
        }))}
        placeholder="选择检索文献库"
        style={{ minWidth: 280 }}
      />
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
      {allRefs.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无参考文献" style={{ padding: 16 }} />
      )}
      <List
        size="small"
        dataSource={allRefs}
        renderItem={(ref: any) => {
          const isExpanded = expandedKey === ref._key;
          const isUploaded = ref._source === 'uploaded';
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
                <Badge status={isUploaded ? 'processing' : 'default'}
                  title={isUploaded ? '用户上传' : '系统检索'} />
                <Text style={{ flex: 1, fontSize: 13 }}
                  ellipsis={{ tooltip: ref.title || ref.formatted }}>
                  {ref.title || (ref.formatted || '').substring(0, 80) + '...'}
                </Text>
                {isUploaded
                  ? <Tooltip title="用户上传"><UplIcon style={{ color: '#1890ff', fontSize: 12 }} /></Tooltip>
                  : <Tooltip title="系统检索"><SearchIcon style={{ color: '#999', fontSize: 12 }} /></Tooltip>}
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
              </div>
              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ padding: '12px 16px 16px 40px', background: '#fafafa' }}>
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
    </Card>
  );
}


export default OutlineGeneration;
