// @ts-nocheck
import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import {
  Card, Button, Typography, Space, Tag, message, Spin, Empty, Select, Input, InputNumber,
} from 'antd';
import {
  FileTextOutlined, SaveOutlined, DownloadOutlined,
  ArrowLeftOutlined, BulbOutlined, SendOutlined, CopyOutlined, ClearOutlined,
} from '@ant-design/icons';
import type { ThesisProject, ThesisStep, ThesisFullTextRequest } from '../../types/thesis';
import { getProjectSteps, generateFulltext, saveFulltext, exportThesis } from '../../services/thesisApi';
import { processText } from '../../services/aiApi';
import { useServiceToken } from '../../hooks/useServiceToken';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

// ── AI Tool definitions (same as AITools page) ──
const AI_TOOLS = [
  { key: 'polish', label: '学术润色', icon: '✨', desc: '提升语言专业性、准确性和流畅度',
    opts: [{ k: 'intensity', label: '强度', choices: ['conservative:保守', 'standard:标准', 'deep:深度'], def: 'standard' },
           { k: 'style', label: '风格', choices: ['academic:通用学术', 'journal:国际期刊', 'thesis:学位论文'], def: 'academic' }] },
  { key: 'translate', label: '中英互译', icon: '🌐', desc: '学术翻译，自动识别源语言',
    opts: [{ k: 'direction', label: '方向', choices: ['auto:自动', 'zh2en:中→英', 'en2zh:英→中'], def: 'auto' }] },
  { key: 'grammar', label: '语法检查', icon: '📝', desc: '纠正语法和拼写错误',
    opts: [{ k: 'level', label: '级别', choices: ['basic:基础', 'detailed:详细'], def: 'detailed' }] },
  { key: 'proofread', label: '终极校对', icon: '🔍', desc: '语法+逻辑+引用四维审查', opts: [] },
  { key: 'reduce_similarity', label: '论文降重', icon: '📉', desc: '句式重构降低重复率', opts: [] },
  { key: 'rewrite', label: '改写重述', icon: '✍️', desc: '全新表达呈现相同内容',
    opts: [{ k: 'intensity', label: '强度', choices: ['light:轻度', 'medium:中度', 'deep:深度'], def: 'medium' }] },
  { key: 'expand', label: '内容扩写', icon: '📈', desc: '扩展论述深度和广度',
    opts: [{ k: 'expand_direction', label: '方向', choices: ['theory:理论', 'methods:方法', 'data:数据', 'comprehensive:综合'], def: 'comprehensive' },
           { k: 'target_multiplier', label: '倍数', type: 'num', def: 2, min: 1.5, max: 5, step: 0.5 }] },
  { key: 'shorten', label: '缩写精简', icon: '📋', desc: '去冗余保核心', opts: [] },
  { key: 'style_change', label: '文风调整', icon: '🎨', desc: '调整写作风格语调', opts: [] },
  { key: 'abstract', label: '生成摘要', icon: '📄', desc: '提炼结构化摘要',
    opts: [{ k: 'format', label: '格式', choices: ['structured:结构化', 'unstructured:非结构化'], def: 'structured' },
           { k: 'word_count', label: '字数', type: 'num', def: 300, min: 100, max: 1000, step: 50 }] },
];

interface Props {
  project: ThesisProject;
  outline: string;
  serviceToken: string;
  onBack: () => void;
}

const FullTextGeneration: FC<Props> = ({ project, outline, serviceToken, onBack }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [fullText, setFullText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // AI tool state
  const [selectedTool, setSelectedTool] = useState<string>('polish');
  const [aiInput, setAiInput] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiChanges, setAiChanges] = useState<any[]>([]);
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiOptions, setAiOptions] = useState<Record<string, any>>({});

  const [selectedText, setSelectedText] = useState('');

  const currentTool = AI_TOOLS.find(t => t.key === selectedTool)!;

  // Load existing fulltext
  const loadSteps = useCallback(async () => {
    if (!project.id) return;
    setLoading(true);
    try {
      const data = await getProjectSteps(project.id, serviceToken);
      const ft = data.find((s: any) => s.step_num === 2);
      if (ft?.content) setFullText(ft.content);
    } catch (err: any) { message.error(err?.message || '加载失败'); }
    finally { setLoading(false); }
  }, [project.id, serviceToken]);

  useEffect(() => { loadSteps(); }, [loadSteps]);

  // Text selection tracking
  useEffect(() => {
    const h = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && contentRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        setSelectedText(sel.toString().trim());
      }
    };
    document.addEventListener('selectionchange', h);
    return () => document.removeEventListener('selectionchange', h);
  }, []);

  // Tool selection — set default options
  const handleToolSelect = (key: string) => {
    setSelectedTool(key);
    const tool = AI_TOOLS.find(t => t.key === key)!;
    const defs: Record<string, any> = {};
    tool.opts.forEach(o => { defs[o.k] = o.def; });
    setAiOptions(defs);
    setAiResult('');
    setAiChanges([]);
    setAiExplanation('');
    // Auto-fill: selected text or fallback
    setAiInput(selectedText || '');
  };

  // Generate fulltext
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateFulltext({ project_id: project.id, token: serviceToken, outline, references: [] } as any);
      setFullText(result.fulltext);
      message.success('全文生成成功！');
    } catch (err: any) { message.error(err?.message || '生成失败'); }
    finally { setGenerating(false); }
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    try {
      await saveFulltext({ project_id: project.id, token: serviceToken, content: fullText });
      message.success('已保存');
    } catch (err: any) { message.error(err?.message || '保存失败'); }
    finally { setSaving(false); }
  };

  // Export
  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportThesis(project.id, serviceToken);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${project.title || '论文'}.docx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
      message.success('已导出');
    } catch (err: any) { message.error(err?.message || '导出失败'); }
    finally { setExporting(false); }
  };

  // Run AI tool
  const handleRunTool = async () => {
    const text = selectedText || aiInput;
    if (!text.trim()) { message.warning('请选中正文文本，或在左侧工具面板输入'); return; }
    setAiProcessing(true);
    setAiResult('');
    try {
      const extra: any = {};
      for (const o of currentTool.opts) {
        const v = aiOptions[o.k] ?? o.def;
        if (v !== undefined && v !== '') extra[o.k] = v;
      }
      const resp: any = await processText({ text, mode: selectedTool, token: serviceToken, ...extra } as any);
      try {
        const parsed = JSON.parse(resp.result || resp);
        setAiResult(parsed.replacement_text || '');
        setAiChanges(parsed.changes || []);
        setAiExplanation(parsed.explanation || '');
      } catch {
        setAiResult(typeof resp === 'string' ? resp : resp.result || JSON.stringify(resp));
      }
    } catch (err: any) { message.error(err?.message || '处理失败'); }
    finally { setAiProcessing(false); }
  };

  // Accept AI result → replace selected text in fulltext
  const handleAccept = () => {
    if (!aiResult) return;
    if (selectedText && fullText.includes(selectedText)) {
      setFullText(fullText.replace(selectedText, aiResult));
    }
    setSelectedText('');
    setAiInput('');
    setAiResult('');
    setAiChanges([]);
    setAiExplanation('');
    message.success('已应用到正文');
  };

  if (loading) return <LoadingSpinner tip="加载项目数据..." />;

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 160px)' }}>
      {/* ═══ LEFT: AI Tools Panel ═══ */}
      <div style={{ width: 320, flexShrink: 0, overflowY: 'auto', borderRight: '1px solid #f0f0f0', paddingRight: 12 }}>
        {/* Back button */}
        <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ marginBottom: 12 }}>返回修改提纲</Button>

        {/* Tool selector */}
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>AI 工具</Text>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
          {AI_TOOLS.map(t => (
            <Tag.CheckableTag key={t.key} checked={selectedTool === t.key}
              onChange={() => handleToolSelect(t.key)}
              style={{ fontSize: 11, padding: '2px 8px', margin: 0, borderRadius: 4,
                background: selectedTool === t.key ? '#1a1a2e' : '#f5f5f5',
                color: selectedTool === t.key ? '#fff' : '#666', border: 'none' }}>
              {t.icon} {t.label}
            </Tag.CheckableTag>
          ))}
        </div>

        <Text type="secondary" style={{ fontSize: 11 }}>{currentTool.desc}</Text>

        {/* Tool options */}
        {currentTool.opts.length > 0 && (
          <div style={{ margin: '8px 0' }}>
            {currentTool.opts.map(o => (
              <div key={o.k} style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: '#888', display: 'block' }}>{o.label}</Text>
                {o.type === 'num' ? (
                  <InputNumber size="small" value={aiOptions[o.k] ?? o.def}
                    onChange={v => setAiOptions(p => ({ ...p, [o.k]: v }))}
                    min={o.min} max={o.max} step={o.step} style={{ width: '100%' }} />
                ) : (
                  <Select size="small" value={aiOptions[o.k] ?? o.def}
                    onChange={v => setAiOptions(p => ({ ...p, [o.k]: v }))}
                    options={o.choices?.map((c: string) => { const [v, l] = c.split(':'); return { value: v, label: l }; }) || []}
                    style={{ width: '100%' }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Input area */}
        <TextArea rows={4} value={aiInput} onChange={e => setAiInput(e.target.value)}
          placeholder={selectedText ? `已选中 ${selectedText.length} 字` : '输入要处理的文本，或直接在正文中选中...'}
          style={{ fontSize: 12, marginBottom: 8 }} />

        {/* Run + Accept */}
        <Space style={{ marginBottom: 12 }}>
          <Button type="primary" size="small" icon={<SendOutlined />} loading={aiProcessing} onClick={handleRunTool}>处理</Button>
          {aiResult && <Button size="small" onClick={handleAccept}>应用到正文</Button>}
        </Space>

        {/* AI Result */}
        {aiProcessing && <Spin size="small" style={{ display: 'block', margin: '12px 0' }} />}
        {aiResult && (
          <Card size="small" title="处理结果" style={{ marginBottom: 8 }}
            extra={<Button size="small" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(aiResult); message.success('已复制'); }} />}>
            <Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.7 }}>{aiResult}</Paragraph>
            {aiExplanation && <Text style={{ fontSize: 11, color: '#888' }}>{aiExplanation}</Text>}
            {aiChanges.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 11, color: '#888' }}>修改详情:</Text>
                {aiChanges.slice(0, 5).map((c: any, i: number) => (
                  <div key={i} style={{ fontSize: 11, marginTop: 4, padding: 4, background: '#fafafa', borderRadius: 4 }}>
                    <Text delete style={{ color: '#999' }}>{c.original}</Text>
                    <Text style={{ color: '#1a1a2e', marginLeft: 6 }}>{c.modified}</Text>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* ═══ RIGHT: Fulltext Content ═══ */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Space>
            <FileTextOutlined style={{ color: '#1a1a2e' }} />
            <Text strong>{project.title}</Text>
          </Space>
          <Space>
            {!fullText && !generating && (
              <Button type="primary" icon={<BulbOutlined />} onClick={handleGenerate} loading={generating}>生成全文</Button>
            )}
            {fullText && (
              <>
                <Button icon={<SaveOutlined />} onClick={handleSave} loading={saving}>保存</Button>
                <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>导出 Word</Button>
              </>
            )}
          </Space>
        </div>

        {/* Content */}
        {generating ? (
          <LoadingSpinner tip="正在生成全文，请耐心等待..." />
        ) : fullText ? (
          <div ref={contentRef} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, fontSize: 14, background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #f0f0f0', minHeight: 400 }}>
            {fullText}
          </div>
        ) : (
          <Empty description="点击「生成全文」开始" style={{ marginTop: 80 }} />
        )}
      </div>
    </div>
  );
};

export default FullTextGeneration;
