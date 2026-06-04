import { useState } from 'react';
import { Card, Select, Input, Button, Typography, Space, message, Spin, Row, Col, Tag, InputNumber, Radio } from 'antd';
import { SendOutlined, CopyOutlined, ClearOutlined } from '@ant-design/icons';
import { processText } from '../services/aiApi';
import { useServiceToken } from '../hooks/useServiceToken';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

// Tool definitions
const TOOLS: ToolDef[] = [
  {
    key: 'polish', label: '学术润色', icon: '✨',
    desc: '提升语言的专业性、准确性和流畅度',
    options: [
      { key: 'intensity', label: '润色强度', type: 'select', choices: [
        { value: 'conservative', label: '保守' }, { value: 'standard', label: '标准' }, { value: 'deep', label: '深度' }
      ], default: 'standard' },
      { key: 'style', label: '写作风格', type: 'select', choices: [
        { value: 'academic', label: '通用学术' }, { value: 'journal', label: '国际期刊' }, { value: 'thesis', label: '学位论文' }
      ], default: 'academic' },
    ],
  },
  {
    key: 'translate', label: '中英互译', icon: '🌐',
    desc: '学术翻译，自动识别源语言',
    options: [
      { key: 'direction', label: '翻译方向', type: 'select', choices: [
        { value: 'auto', label: '自动识别' }, { value: 'zh2en', label: '中→英' }, { value: 'en2zh', label: '英→中' }
      ], default: 'auto' },
    ],
  },
  {
    key: 'grammar', label: '语法检查', icon: '📝',
    desc: '检测并纠正语法错误、拼写错误',
    options: [
      { key: 'level', label: '检查级别', type: 'select', choices: [
        { value: 'basic', label: '基础' }, { value: 'detailed', label: '详细' }
      ], default: 'detailed' },
    ],
  },
  {
    key: 'proofread', label: '终极校对', icon: '🔍',
    desc: '语法+逻辑+引用+数据四维审查',
    options: [],
  },
  {
    key: 'reduce_similarity', label: '论文降重', icon: '📉',
    desc: '通过句式重构降低文本重复率',
    options: [],
  },
  {
    key: 'rewrite', label: '改写重述', icon: '✍️',
    desc: '用全新表达方式呈现相同内容',
    options: [
      { key: 'intensity', label: '改写强度', type: 'select', choices: [
        { value: 'light', label: '轻度' }, { value: 'medium', label: '中度' }, { value: 'deep', label: '深度' }
      ], default: 'medium' },
    ],
  },
  {
    key: 'expand', label: '内容扩写', icon: '📈',
    desc: '扩展论述深度和广度',
    options: [
      { key: 'expand_direction', label: '扩写方向', type: 'select', choices: [
        { value: 'theory', label: '理论依据' }, { value: 'methods', label: '方法细节' }, { value: 'data', label: '数据分析' }, { value: 'comprehensive', label: '综合扩写' }
      ], default: 'comprehensive' },
      { key: 'target_multiplier', label: '目标倍数', type: 'number', default: 2, min: 1.5, max: 5, step: 0.5 },
    ],
  },
  {
    key: 'shorten', label: '缩写精简', icon: '📋',
    desc: '去除冗余，保留核心结论和证据',
    options: [],
  },
  {
    key: 'style_change', label: '文风调整', icon: '🎨',
    desc: '调整文本的写作风格和语调',
    options: [],
  },
  {
    key: 'abstract', label: '生成摘要', icon: '📄',
    desc: '从研究内容提炼结构化摘要',
    options: [
      { key: 'format', label: '摘要格式', type: 'select', choices: [
        { value: 'structured', label: '结构化' }, { value: 'unstructured', label: '非结构化' }
      ], default: 'structured' },
      { key: 'word_count', label: '目标字数', type: 'number', default: 300, min: 100, max: 1000, step: 50 },
    ],
  },
];

interface ToolDef {
  key: string;
  label: string;
  icon: string;
  desc: string;
  options: ToolOption[];
}

interface ToolOption {
  key: string;
  label: string;
  type: 'select' | 'number';
  choices?: { value: string; label: string }[];
  default: any;
  min?: number;
  max?: number;
  step?: number;
}

export default function AITools() {
  const { serviceToken } = useServiceToken();
  const [selectedTool, setSelectedTool] = useState<string>('polish');
  const [inputText, setInputText] = useState('');
  const [options, setOptions] = useState<Record<string, any>>({});
  const [result, setResult] = useState<string>('');
  const [changes, setChanges] = useState<any[]>([]);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);

  const currentTool = TOOLS.find(t => t.key === selectedTool)!;

  const handleToolChange = (toolKey: string) => {
    setSelectedTool(toolKey);
    const tool = TOOLS.find(t => t.key === toolKey)!;
    const defaults: Record<string, any> = {};
    tool.options.forEach(o => { defaults[o.key] = o.default; });
    setOptions(defaults);
    setResult('');
    setChanges([]);
    setExplanation('');
  };

  const handleRun = async () => {
    if (!inputText.trim()) { message.warning('请输入文本'); return; }
    setLoading(true);
    setResult('');
    try {
      const extra: Record<string, any> = {};
      for (const opt of currentTool.options) {
        const val = options[opt.key] ?? opt.default;
        if (val !== undefined && val !== '') extra[opt.key] = val;
      }
      const response: any = await processText({
        text: inputText,
        mode: selectedTool,
        token: serviceToken,
        ...extra,
      } as any);

      // Parse the result — could be JSON string or plain text
      try {
        const parsed = JSON.parse(response.result || response);
        setResult(parsed.replacement_text || '');
        setChanges(parsed.changes || []);
        setExplanation(parsed.explanation || '');
      } catch {
        setResult(typeof response === 'string' ? response : response.result || JSON.stringify(response));
      }
    } catch (err: any) {
      message.error(err?.message || '处理失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 20 }}>AI 学术工具</Title>

      {/* Tool selector — horizontal tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {TOOLS.map(t => (
          <Tag.CheckableTag
            key={t.key}
            checked={selectedTool === t.key}
            onChange={() => handleToolChange(t.key)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              border: selectedTool === t.key ? '1px solid #1a1a2e' : '1px solid #e0e0e0',
              background: selectedTool === t.key ? '#1a1a2e' : '#fff',
              color: selectedTool === t.key ? '#fff' : '#333',
            }}
          >
            {t.icon} {t.label}
          </Tag.CheckableTag>
        ))}
      </div>

      {/* Tool description */}
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>{currentTool.desc}</Paragraph>

      <Row gutter={24}>
        {/* Left: Input */}
        <Col xs={24} lg={12}>
          <Card size="small" title="输入文本" style={{ marginBottom: 16 }}>
            <TextArea
              rows={10}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="在此粘贴或输入需要处理的学术文本..."
              style={{ fontSize: 14 }}
            />
            {/* Options */}
            {currentTool.options.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>处理选项</Text>
                <Space wrap>
                  {currentTool.options.map(opt => (
                    <div key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 12, color: '#888' }}>{opt.label}:</Text>
                      {opt.type === 'select' ? (
                        <Select
                          size="small"
                          value={options[opt.key] ?? opt.default}
                          onChange={v => setOptions(prev => ({ ...prev, [opt.key]: v }))}
                          options={opt.choices?.map(c => ({ value: c.value, label: c.label })) || []}
                          style={{ width: 100 }}
                        />
                      ) : (
                        <InputNumber
                          size="small"
                          value={options[opt.key] ?? opt.default}
                          onChange={v => setOptions(prev => ({ ...prev, [opt.key]: v }))}
                          min={opt.min} max={opt.max} step={opt.step}
                          style={{ width: 80 }}
                        />
                      )}
                    </div>
                  ))}
                </Space>
              </div>
            )}
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <Button type="primary" icon={<SendOutlined />} onClick={handleRun} loading={loading} style={{ borderRadius: 6 }}>
                开始处理
              </Button>
              <Button icon={<ClearOutlined />} onClick={() => { setInputText(''); setResult(''); setChanges([]); setExplanation(''); }}
                disabled={!inputText && !result}>
                清空
              </Button>
            </div>
          </Card>
        </Col>

        {/* Right: Result */}
        <Col xs={24} lg={12}>
          <Card size="small" title="处理结果" style={{ marginBottom: 16 }}
            extra={result ? <Button size="small" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(result); message.success('已复制'); }}>复制</Button> : undefined}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin tip="AI 处理中..." /></div>
            ) : result ? (
              <div>
                <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, background: '#fafafa', padding: 12, borderRadius: 6, fontSize: 14 }}>
                  {result}
                </Paragraph>
                {explanation && (
                  <Card size="small" title="修改说明" style={{ marginTop: 12, background: '#f0f5ff' }}>
                    <Text style={{ fontSize: 13 }}>{explanation}</Text>
                  </Card>
                )}
                {changes.length > 0 && (
                  <Card size="small" title={`具体修改 (${changes.length})`} style={{ marginTop: 12 }}>
                    {changes.map((c: any, i: number) => (
                      <div key={i} style={{ marginBottom: 8, padding: 8, background: '#fff', borderRadius: 4, border: '1px solid #f0f0f0' }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>原文:</Text>
                        <Paragraph style={{ fontSize: 12, margin: '2px 0', color: '#999', textDecoration: 'line-through' }}>{c.original}</Paragraph>
                        <Text type="secondary" style={{ fontSize: 11 }}>修改:</Text>
                        <Paragraph style={{ fontSize: 12, margin: '2px 0', color: '#1a1a2e' }}>{c.modified}</Paragraph>
                        {c.reason && <Tag style={{ fontSize: 10 }}>{c.reason}</Tag>}
                      </div>
                    ))}
                  </Card>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#ccc' }}>结果将在这里显示</div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
