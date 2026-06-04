// @ts-nocheck
import { useState, useEffect, useRef, useCallback, type FC } from 'react';
import {
  Button,
  Typography,
  Space,
  message,
  Empty,
  Collapse,
  Divider,
  Tag,
} from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  SaveOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import type { ThesisProject, ThesisStep, ThesisFullTextRequest, AIProcessRequest } from '../../types/thesis';
import {
  getProjectSteps,
  generateFulltext,
  saveFulltext,
  exportThesis,
} from '../../services/thesisApi';
import { processText } from '../../services/aiApi';
import AIOperationsToolbar, {
  type AIOperationOptions,
} from './AIOperationsToolbar';
import AIEditModal from './AIEditModal';
import type { AIProcessResponse } from '../../types/thesis';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const { Text, Title, Paragraph } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FullTextGenerationProps {
  project: ThesisProject;
  outline: string;
  serviceToken: string;
  onBack: () => void;
}

interface OutlineSection {
  key: string;
  title: string;
  level: number;
  children: OutlineSection[];
  content: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseMarkdownOutline(markdown: string): OutlineSection[] {
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
      if (currentH2) { flushContent(currentH2); currentH2 = null; }
      else if (currentSection) flushContent(currentSection);
      currentSection = { key: `sec-${sections.length}`, title: h1Match[1].trim(), level: 1, children: [], content: '' };
      sections.push(currentSection);
    } else if (h2Match) {
      if (currentH2) flushContent(currentH2);
      const child: OutlineSection = { key: `h2-${currentSection?.children.length ?? 0}`, title: h2Match[1].trim(), level: 2, children: [], content: '' };
      if (currentSection) { currentSection.children.push(child); currentH2 = child; }
      else { currentSection = { key: `sec-${sections.length}`, title: child.title, level: 1, children: [], content: '' }; sections.push(currentSection); }
    } else if (h3Match) {
      if (currentH2) flushContent(currentH2);
      const sub: OutlineSection = { key: `h3-${currentH2?.children.length ?? 0}`, title: h3Match[1].trim(), level: 3, children: [], content: '' };
      if (currentH2) currentH2.children.push(sub);
      else if (currentSection) currentSection.children.push(sub);
      currentH2 = null;
    } else {
      contentBuffer.push(line);
    }
  }

  if (currentH2) flushContent(currentH2);
  else if (currentSection) flushContent(currentSection);
  return sections;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const FullTextGeneration: FC<FullTextGenerationProps> = ({
  project,
  outline,
  serviceToken,
  onBack,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // State
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<ThesisStep[]>([]);
  const [fullText, setFullText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  // AI operations state
  const [selectedText, setSelectedText] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<AIProcessResponse | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiOriginalText, setAiOriginalText] = useState('');

  // -------------------------------------------------------------------------
  // Load project steps to find existing fulltext
  // -------------------------------------------------------------------------
  const loadSteps = useCallback(async (): Promise<void> => {
    if (!project.id) return;
    setLoading(true);
    try {
      const data = await getProjectSteps(project.id, serviceToken);
      setSteps(data);

      const fulltextStep = data.find((s: any) => s.step_num === 2);
      if (fulltextStep?.content) {
        setFullText(fulltextStep.content);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载项目数据失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [project.id, serviceToken]);

  useEffect(() => {
    loadSteps();
  }, [loadSteps]);

  // -------------------------------------------------------------------------
  // Text selection listener
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleSelectionChange = (): void => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }

      // Only track selection within our content area
      if (contentRef.current) {
        const range = selection.getRangeAt(0);
        if (contentRef.current.contains(range.commonAncestorContainer)) {
          setSelectedText(selection.toString().trim());
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () =>
      document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // -------------------------------------------------------------------------
  // Generate full text
  // -------------------------------------------------------------------------
  const handleGenerate = async (): Promise<void> => {
    setGenerating(true);
    try {
      const request: ThesisFullTextRequest = {
        project_id: project.id,
        token: serviceToken,
        outline: outline,
        references: [],
      };

      const result = await generateFulltext(request);
      setFullText(result.fulltext);
      message.success('全文生成成功！');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成全文失败';
      message.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  // -------------------------------------------------------------------------
  // Save fulltext
  // -------------------------------------------------------------------------
  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await saveFulltext({
        project_id: project.id,
        token: serviceToken,
        full_text: fullText,
      });
      message.success('全文已保存');
      await loadSteps();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Export thesis
  // -------------------------------------------------------------------------
  const handleExport = async (): Promise<void> => {
    setExporting(true);
    try {
      const blob = await exportThesis(project.id, serviceToken);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.title ?? '论文'}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('论文已导出为 Word 文档');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '导出失败';
      message.error(msg);
    } finally {
      setExporting(false);
    }
  };

  // -------------------------------------------------------------------------
  // AI Operation: trigger from toolbar
  // -------------------------------------------------------------------------
  const handleAIOperation = async (
    mode: string,
    options: AIOperationOptions,
  ): Promise<void> => {
    const textToProcess = selectedText || fullText;

    if (!textToProcess) {
      message.warning('请先选择要处理的文本，或等待全文生成后再操作');
      return;
    }

    setAiOriginalText(textToProcess);
    setAiProcessing(true);
    setAiModalOpen(true);
    setAiResult(null);

    try {
      // Build instructions from options
      const instructionParts: string[] = [];
      if (options.intensity)
        instructionParts.push(`强度：${options.intensity}`);
      if (options.style)
        instructionParts.push(`风格：${options.style}`);
      if (options.direction)
        instructionParts.push(`方向：${options.direction}`);
      if (options.level)
        instructionParts.push(`级别：${options.level}`);
      if (options.target_multiplier)
        instructionParts.push(
          `扩写倍数：${options.target_multiplier}`,
        );
      if (options.format)
        instructionParts.push(`格式：${options.format}`);
      if (options.word_count)
        instructionParts.push(`字数：${options.word_count}`);

      const request: AIProcessRequest = {
        token: serviceToken,
        text: textToProcess,
        mode,
        instructions:
          instructionParts.length > 0
            ? instructionParts.join('；')
            : undefined,
        discipline: project.discipline,
        thesis_type: project.thesis_type,
        language: project.language,
      };

      const result = await processText(request);
      setAiResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI 处理失败';
      message.error(msg);
      setAiModalOpen(false);
    } finally {
      setAiProcessing(false);
    }
  };

  // -------------------------------------------------------------------------
  // Accept AI result
  // -------------------------------------------------------------------------
  const handleAcceptAIResult = (resultText: string): void => {
    if (selectedText) {
      // Replace selected text within full text
      const newFullText = fullText.replace(selectedText, resultText);
      setFullText(newFullText);
    } else {
      setFullText(resultText);
    }
    setAiModalOpen(false);
    setAiResult(null);
    setSelectedText('');
    message.success('修改已应用');
  };

  // -------------------------------------------------------------------------
  // Render markdown-like text
  // -------------------------------------------------------------------------
  const renderMarkdownText = (text: string): React.ReactNode => {
    if (!text) return <Empty description="暂无内容" />;

    return text.split('\n').map((line, idx) => {
      if (line.startsWith('# ')) {
        return (
          <Title key={idx} level={2} style={{ marginTop: 24 }}>
            {line.replace(/^#\s+/, '')}
          </Title>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <Title key={idx} level={3} style={{ marginTop: 20 }}>
            {line.replace(/^##\s+/, '')}
          </Title>
        );
      }
      if (line.startsWith('### ')) {
        return (
          <Title key={idx} level={4} style={{ marginTop: 16 }}>
            {line.replace(/^###\s+/, '')}
          </Title>
        );
      }
      if (line.trim() === '') {
        return <br key={idx} />;
      }

      // Render inline bold and italic
      const html = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');

      return (
        <Paragraph
          key={idx}
          style={{
            lineHeight: 1.9,
            marginBottom: 8,
          }}
        >
          <span dangerouslySetInnerHTML={{ __html: html }} />
        </Paragraph>
      );
    });
  };

  // -------------------------------------------------------------------------
  // Render outline sidebar
  // -------------------------------------------------------------------------
  const outlineSections = parseMarkdownOutline(outline);

  const renderOutlineSidebar = (): React.ReactNode => {
    if (outlineSections.length === 0) {
      return (
        <div>
          <Text type="secondary">无提纲结构</Text>
        </div>
      );
    }

    // Skip title section (first h1) — show it as header
    const [titleSection, ...bodySections] = outlineSections;

    return (
      <div>
        {/* Paper title header */}
        {titleSection && (
          <div style={{ textAlign: 'center', padding: '0 0 12px', borderBottom: '1px solid #f0f0f0', marginBottom: 8 }}>
            <Text strong style={{ fontSize: 13 }}>{titleSection.title}</Text>
          </div>
        )}
        <Collapse
          size="small"
          defaultActiveKey={bodySections.map((s) => s.key)}
          items={bodySections.map((section) => ({
            key: section.key,
            label: (
              <Text strong style={{ fontSize: 12 }}>{section.title}</Text>
            ),
            children: (
              <div style={{ paddingLeft: 4 }}>
                {section.content && (
                  <Paragraph style={{ fontSize: 11, color: '#888', marginBottom: 8, whiteSpace: 'pre-wrap' }}
                    ellipsis={{ rows: 3 }}>
                    {section.content}
                  </Paragraph>
                )}
                {section.children.map((child) => (
                  <div key={child.key} style={{
                    marginBottom: 6, paddingLeft: 8,
                    borderLeft: '2px solid #e8e8e8',
                  }}>
                    <Text style={{ fontSize: 11, color: '#555' }}>{child.title}</Text>
                    {child.content && (
                      <Paragraph style={{ fontSize: 10, color: '#999', margin: '2px 0 0', whiteSpace: 'pre-wrap' }}
                        ellipsis={{ rows: 2 }}>
                        {child.content}
                      </Paragraph>
                    )}
                    {child.children.length > 0 && (
                      <div style={{ paddingLeft: 8 }}>
                        {child.children.map((sub) => (
                          <div key={sub.key} style={{ marginTop: 2 }}>
                            <Text style={{ fontSize: 10, color: '#999' }}>- {sub.title}</Text>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ),
          }))}
        />
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return <LoadingSpinner tip="加载项目数据..." />;
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        height: 'calc(100vh - 200px)',
        minHeight: 600,
      }}
    >
      {/* ---- Left: Outline Sidebar ---- */}
      <div
        style={{
          width: 260,
          minWidth: 260,
          borderRight: '1px solid #f0f0f0',
          paddingRight: 12,
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text strong>论文提纲</Text>
          <Button size="small" type="text" onClick={onBack}>
            返回修改
          </Button>
        </div>
        {renderOutlineSidebar()}

        <Divider style={{ margin: '12px 0' }} />

        {/* Selected text indicator */}
        <div style={{ marginTop: 12 }}>
          <Button
            size="small"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
          >
            返回修改提纲
          </Button>
        </div>
      </div>

      {/* ---- Right: Full Text Editor ---- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <AIOperationsToolbar
          disabled={!fullText && !selectedText}
          onOperation={handleAIOperation}
        />

        {/* Content area */}
        <div
          ref={contentRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 24px',
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            backgroundColor: '#fff',
            userSelect: 'text',
          }}
        >
          {generating ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <LoadingSpinner tip="正在生成全文，这可能需要几分钟时间..." />
              <Text
                type="secondary"
                style={{ display: 'block', marginTop: 16 }}
              >
                AI 正在根据提纲逐章撰写论文内容，请耐心等待
              </Text>
            </div>
          ) : fullText ? (
            renderMarkdownText(fullText)
          ) : (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
              }}
            >
              <Empty description="尚未生成全文">
                <Button
                  type="primary"
                  size="large"
                  icon={<BulbOutlined />}
                  onClick={handleGenerate}
                  loading={generating}
                >
                  生成全文
                </Button>
              </Empty>
            </div>
          )}

          {/* Selected text indicator */}
          {selectedText && (
            <div
              style={{
                position: 'sticky',
                bottom: 16,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <Tag
                color="blue"
                style={{
                  padding: '4px 16px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                已选中文本（{selectedText.length} 字符），点击上方 AI 操作按钮处理
              </Tag>
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 12,
          }}
        >
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
              返回修改提纲
            </Button>
          </Space>

          <Space>
            <Button
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={!fullText}
            >
              保存全文
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              loading={exporting}
              disabled={!fullText}
            >
              导出 Word
            </Button>
          </Space>
        </div>
      </div>

      {/* ---- AI Edit Modal ---- */}
      <AIEditModal
        open={aiModalOpen}
        original={aiOriginalText}
        result={aiResult}
        loading={aiProcessing}
        onAccept={handleAcceptAIResult}
        onClose={() => {
          setAiModalOpen(false);
          setAiResult(null);
        }}
      />

      {/* ---- Generating overlay ---- */}
      {generating && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <LoadingSpinner tip="AI 正在撰写全文，请耐心等待..." />
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
            长篇写作可能需要较长时间，您可以稍后回来查看
          </Text>
        </div>
      )}
    </div>
  );
};

export default FullTextGeneration;
