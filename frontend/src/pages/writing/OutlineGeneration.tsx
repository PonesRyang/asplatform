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

const { Text } = Typography;

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
  const lines = markdown.split('\n').filter(Boolean);
  const sections: OutlineSection[] = [];
  let currentSection: OutlineSection | null = null;

  for (const line of lines) {
    const h1Match = line.match(/^#\s+(.+)/);
    const h2Match = line.match(/^##\s+(.+)/);
    const h3Match = line.match(/^###\s+(.+)/);

    if (h1Match) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        key: `sec-${sections.length}`,
        title: h1Match[1].trim(),
        level: 1,
        children: [],
        raw: line,
      };
    } else if (h2Match) {
      const child: OutlineSection = {
        key: `${currentSection?.key ?? 's'}-${currentSection?.children.length ?? 0}`,
        title: h2Match[1].trim(),
        level: 2,
        children: [],
        raw: line,
      };
      if (currentSection) {
        currentSection.children.push(child);
      } else {
        currentSection = {
          key: `sec-${sections.length}`,
          title: child.title,
          level: 1,
          children: [],
          raw: line,
        };
        sections.push(currentSection);
      }
    } else if (h3Match) {
      const child: OutlineSection = {
        key: `h3-${sections.length}-${currentSection?.children.length ?? 0}`,
        title: h3Match[1].trim(),
        level: 3,
        children: [],
        raw: line,
      };
      if (currentSection?.children.length) {
        const lastChild =
          currentSection.children[currentSection.children.length - 1];
        if (lastChild.level === 2) {
          lastChild.children.push(child);
        } else {
          currentSection.children.push(child);
        }
      } else if (currentSection) {
        currentSection.children.push(child);
      }
    }
  }

  if (currentSection) sections.push(currentSection);
  return { sections };
}

interface OutlineSection {
  key: string;
  title: string;
  level: number;
  children: OutlineSection[];
  raw: string;
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

  // -------------------------------------------------------------------------
  // Generate outline
  // -------------------------------------------------------------------------
  const handleGenerateOutline = async (): Promise<void> => {
    setGenerating(true);
    try {
      const request: ThesisOutlineRequest = {
        project_id: project.id,
        token: serviceToken,
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
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            lineHeight: 1.8,
            background: '#fafafa',
            padding: 16,
            borderRadius: 8,
          }}
        >
          {outlineContent}
        </pre>
      );
    }

    return (
      <Collapse
        size="small"
        items={sections.map((section) => ({
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
              {section.children.map((child) => (
                <Card
                  key={child.key}
                  size="small"
                  style={{ marginBottom: 8 }}
                  title={
                    <Text style={{ fontSize: 13 }}>
                      {child.title}
                    </Text>
                  }
                >
                  {child.children.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {child.children.map((sub) => (
                        <li key={sub.key}>{sub.title}</li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          ),
        }))}
      />
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

export default OutlineGeneration;
