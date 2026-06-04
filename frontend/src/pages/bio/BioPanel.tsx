// @ts-nocheck
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Typography,
  Tabs,
  Upload,
  Button,
  Input,
  Select,
  InputNumber,
  Table,
  Card,
  message,
  Form,
  Tag,
  Tooltip,
  Alert,
} from 'antd';
import {
  UploadOutlined,
  PlayCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useDataParser } from '../../hooks/useDataParser';
import { analyzeBioData } from '../../services/bioApi';
import type { BioTool, BioToolParameter } from '../../config/bioTools';
import type { AnalysisResult } from '../../types/bio';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

interface BioPanelProps {
  tool: BioTool | undefined;
  onResult: (result: AnalysisResult) => void;
}

// ---------------------------------------------------------------------------
// Demo data generators
// ---------------------------------------------------------------------------

function generateDemoData(toolKey: string): Record<string, unknown>[] {
  switch (toolKey) {
    case 'bar':
    case 'box':
    case 'violin':
      return [
        { 分组: '对照组', 数值: 25.3, 处理组: 'A' },
        { 分组: '对照组', 数值: 22.1, 处理组: 'A' },
        { 分组: '对照组', 数值: 27.8, 处理组: 'A' },
        { 分组: '治疗组A', 数值: 18.5, 处理组: 'B' },
        { 分组: '治疗组A', 数值: 19.2, 处理组: 'B' },
        { 分组: '治疗组A', 数值: 17.9, 处理组: 'B' },
        { 分组: '治疗组B', 数值: 15.1, 处理组: 'C' },
        { 分组: '治疗组B', 数值: 16.3, 处理组: 'C' },
        { 分组: '治疗组B', 数值: 14.7, 处理组: 'C' },
      ];

    case 'line':
    case 'scatter':
    case 'smooth_curve':
      return [
        { 时间: 0, 浓度: 10.0, 组别: '样本A' },
        { 时间: 1, 浓度: 8.5, 组别: '样本A' },
        { 时间: 2, 浓度: 7.2, 组别: '样本A' },
        { 时间: 3, 浓度: 6.1, 组别: '样本A' },
        { 时间: 4, 浓度: 5.0, 组别: '样本A' },
        { 时间: 0, 浓度: 9.5, 组别: '样本B' },
        { 时间: 1, 浓度: 7.8, 组别: '样本B' },
        { 时间: 2, 浓度: 6.5, 组别: '样本B' },
        { 时间: 3, 浓度: 5.2, 组别: '样本B' },
        { 时间: 4, 浓度: 4.1, 组别: '样本B' },
      ];

    case 'histogram':
      return [
        { 基因表达: 12.5 },
        { 基因表达: 13.1 },
        { 基因表达: 11.8 },
        { 基因表达: 14.2 },
        { 基因表达: 10.5 },
        { 基因表达: 13.7 },
        { 基因表达: 12.0 },
        { 基因表达: 15.1 },
        { 基因表达: 11.3 },
        { 基因表达: 12.8 },
        { 基因表达: 9.7 },
        { 基因表达: 13.4 },
        { 基因表达: 14.9 },
        { 基因表达: 11.0 },
        { 基因表达: 12.3 },
      ];

    case 'heatmap':
    case 'cluster_heatmap':
      return [
        { 样本: '基因A', '第1天': 1.2, '第2天': 2.1, '第3天': 3.4, '第7天': 5.1 },
        { 样本: '基因B', '第1天': 0.8, '第2天': 1.5, '第3天': 2.3, '第7天': 3.8 },
        { 样本: '基因C', '第1天': 2.1, '第2天': 2.8, '第3天': 3.1, '第7天': 4.2 },
        { 样本: '基因D', '第1天': 0.5, '第2天': 0.9, '第3天': 1.8, '第7天': 3.5 },
        { 样本: '基因E', '第1天': 1.7, '第2天': 1.3, '第3天': 0.9, '第7天': 0.6 },
      ];

    case 'volcano':
      return [
        { 基因: 'TP53', log2FC: 2.5, P值: 0.0001 },
        { 基因: 'BRCA1', log2FC: -1.8, P值: 0.0005 },
        { 基因: 'EGFR', log2FC: 3.2, P值: 0.00001 },
        { 基因: 'MYC', log2FC: 1.1, P值: 0.03 },
        { 基因: 'ACTB', log2FC: -0.3, P值: 0.5 },
        { 基因: 'GAPDH', log2FC: 0.2, P值: 0.6 },
        { 基因: 'VEGFA', log2FC: 2.1, P值: 0.001 },
        { 基因: 'KRAS', log2FC: 1.5, P值: 0.008 },
        { 基因: 'PTEN', log2FC: -2.3, P值: 0.0002 },
        { 基因: 'AKT1', log2FC: 0.8, P值: 0.08 },
      ];

    case 'ttest':
    case 'wilcox':
      return [
        { 分组: '对照组', 表达量: 5.2 },
        { 分组: '对照组', 表达量: 5.8 },
        { 分组: '对照组', 表达量: 4.9 },
        { 分组: '对照组', 表达量: 5.5 },
        { 分组: '对照组', 表达量: 5.1 },
        { 分组: '对照组', 表达量: 5.7 },
        { 分组: '治疗组', 表达量: 3.2 },
        { 分组: '治疗组', 表达量: 3.5 },
        { 分组: '治疗组', 表达量: 3.1 },
        { 分组: '治疗组', 表达量: 3.8 },
        { 分组: '治疗组', 表达量: 2.9 },
        { 分组: '治疗组', 表达量: 3.4 },
      ];

    case 'anova':
      return [
        { 分组: '对照组', 测量值: 25.1 },
        { 分组: '对照组', 测量值: 24.3 },
        { 分组: '对照组', 测量值: 26.0 },
        { 分组: '对照组', 测量值: 24.8 },
        { 分组: '低剂量', 测量值: 20.2 },
        { 分组: '低剂量', 测量值: 21.1 },
        { 分组: '低剂量', 测量值: 19.5 },
        { 分组: '低剂量', 测量值: 20.8 },
        { 分组: '高剂量', 测量值: 15.3 },
        { 分组: '高剂量', 测量值: 16.1 },
        { 分组: '高剂量', 测量值: 14.7 },
        { 分组: '高剂量', 测量值: 15.9 },
      ];

    case 'chisq':
    case 'fisher':
      return [
        { 性别: '男', 患病: '是' },
        { 性别: '男', 患病: '否' },
        { 性别: '男', 患病: '是' },
        { 性别: '男', 患病: '否' },
        { 性别: '男', 患病: '否' },
        { 性别: '女', 患病: '是' },
        { 性别: '女', 患病: '是' },
        { 性别: '女', 患病: '是' },
        { 性别: '女', 患病: '否' },
        { 性别: '女', 患病: '是' },
      ];

    case 'linreg':
    case 'logreg':
      return [
        { 剂量: 1, 响应: 2.1 },
        { 剂量: 2, 响应: 4.3 },
        { 剂量: 3, 响应: 5.8 },
        { 剂量: 4, 响应: 8.1 },
        { 剂量: 5, 响应: 10.4 },
        { 剂量: 6, 响应: 12.0 },
        { 剂量: 7, 响应: 13.9 },
        { 剂量: 8, 响应: 16.2 },
      ];

    case 'lasso':
    case 'ridge':
      return [
        { 年龄: 45, 血压: 128, 体重指数: 24.5, 胆固醇: 200, 指标: 1.2 },
        { 年龄: 52, 血压: 135, 体重指数: 27.8, 胆固醇: 220, 指标: 2.8 },
        { 年龄: 38, 血压: 118, 体重指数: 22.1, 胆固醇: 180, 指标: 0.5 },
        { 年龄: 60, 血压: 145, 体重指数: 30.2, 胆固醇: 250, 指标: 4.1 },
        { 年龄: 42, 血压: 125, 体重指数: 25.0, 胆固醇: 195, 指标: 1.0 },
        { 年龄: 55, 血压: 140, 体重指数: 28.5, 胆固醇: 230, 指标: 3.2 },
      ];

    case 'corr':
      return [
        { 身高: 170, 体重: 65, 肺活量: 3.5, 握力: 42 },
        { 身高: 165, 体重: 55, 肺活量: 2.8, 握力: 35 },
        { 身高: 180, 体重: 80, 肺活量: 4.2, 握力: 50 },
        { 身高: 175, 体重: 72, 肺活量: 3.8, 握力: 45 },
        { 身高: 160, 体重: 50, 肺活量: 2.5, 握力: 30 },
        { 身高: 185, 体重: 85, 肺活量: 4.5, 握力: 55 },
        { 身高: 168, 体重: 60, 肺活量: 3.0, 握力: 38 },
      ];

    case 'km':
    case 'logrank':
      return [
        { 时间月: 3, 事件: 0, 组别: '低风险' },
        { 时间月: 8, 事件: 1, 组别: '低风险' },
        { 时间月: 15, 事件: 0, 组别: '低风险' },
        { 时间月: 22, 事件: 1, 组别: '低风险' },
        { 时间月: 28, 事件: 0, 组别: '低风险' },
        { 时间月: 2, 事件: 1, 组别: '高风险' },
        { 时间月: 5, 事件: 1, 组别: '高风险' },
        { 时间月: 9, 事件: 1, 组别: '高风险' },
        { 时间月: 14, 事件: 0, 组别: '高风险' },
        { 时间月: 20, 事件: 1, 组别: '高风险' },
      ];

    case 'cox':
      return [
        { 时间月: 5, 事件: 1, 年龄: 65, 分期: 3, 标记物: 12.5 },
        { 时间月: 12, 事件: 0, 年龄: 52, 分期: 2, 标记物: 8.2 },
        { 时间月: 3, 事件: 1, 年龄: 70, 分期: 4, 标记物: 15.1 },
        { 时间月: 18, 事件: 0, 年龄: 48, 分期: 1, 标记物: 5.3 },
        { 时间月: 8, 事件: 1, 年龄: 58, 分期: 3, 标记物: 10.7 },
      ];

    case 'roc':
      return [
        { 真实标签: 1, 预测概率: 0.92 },
        { 真实标签: 1, 预测概率: 0.85 },
        { 真实标签: 1, 预测概率: 0.78 },
        { 真实标签: 1, 预测概率: 0.95 },
        { 真实标签: 1, 预测概率: 0.71 },
        { 真实标签: 0, 预测概率: 0.45 },
        { 真实标签: 0, 预测概率: 0.32 },
        { 真实标签: 0, 预测概率: 0.21 },
        { 真实标签: 0, 预测概率: 0.55 },
        { 真实标签: 0, 预测概率: 0.38 },
        { 真实标签: 0, 预测概率: 0.15 },
        { 真实标签: 0, 预测概率: 0.48 },
      ];

    case 'pca':
    case 'plsda':
      return [
        { 样本ID: 'S1', 基因A: 2.5, 基因B: 1.2, 基因C: 3.1, 基因D: 0.8, 组别: '正常' },
        { 样本ID: 'S2', 基因A: 2.1, 基因B: 1.5, 基因C: 2.8, 基因D: 1.0, 组别: '正常' },
        { 样本ID: 'S3', 基因A: 2.8, 基因B: 0.9, 基因C: 3.3, 基因D: 0.7, 组别: '正常' },
        { 样本ID: 'S4', 基因A: 5.1, 基因B: 3.2, 基因C: 1.5, 基因D: 2.1, 组别: '肿瘤' },
        { 样本ID: 'S5', 基因A: 5.5, 基因B: 3.5, 基因C: 1.2, 基因D: 2.4, 组别: '肿瘤' },
        { 样本ID: 'S6', 基因A: 4.8, 基因B: 3.0, 基因C: 1.8, 基因D: 1.9, 组别: '肿瘤' },
      ];

    case 'circular_heatmap':
      return [
        { 类别: '代谢通路A', 表达量: 3.5, 分组: '上调' },
        { 类别: '代谢通路B', 表达量: -2.1, 分组: '下调' },
        { 类别: '代谢通路C', 表达量: 1.8, 分组: '上调' },
        { 类别: '代谢通路D', 表达量: -1.5, 分组: '下调' },
        { 类别: '信号通路E', 表达量: 4.2, 分组: '上调' },
        { 类别: '信号通路F', 表达量: -3.0, 分组: '下调' },
        { 类别: '细胞周期G', 表达量: 2.3, 分组: '上调' },
        { 类别: '凋亡通路H', 表达量: 0.5, 分组: '上调' },
      ];

    default:
      return [
        { 变量A: 10, 变量B: 25, 分组: '组1' },
        { 变量A: 15, 变量B: 30, 分组: '组1' },
        { 变量A: 20, 变量B: 35, 分组: '组2' },
        { 变量A: 25, 变量B: 40, 分组: '组2' },
      ];
  }
}

// ---------------------------------------------------------------------------
// Parameter rendering helpers
// ---------------------------------------------------------------------------

function isSpecialTitleParam(param: BioToolParameter): boolean {
  return param.key === 'title' && param.type === 'columnSelect';
}

function getEffectiveParamType(param: BioToolParameter): BioToolParameter['type'] {
  if (isSpecialTitleParam(param)) return 'select'; // treat as text
  return param.type;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BioPanel({ tool, onResult }: BioPanelProps) {
  const { parsedData, columns, error: parseError, parse, clear } = useDataParser();
  const [activeTab, setActiveTab] = useState<string>('paste');
  const [pastedText, setPastedText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Parameter form values
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});

  // Track previous tool key to detect changes
  const prevToolKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const currentKey = tool?.key ?? null;
    if (currentKey !== prevToolKeyRef.current) {
      const changed = prevToolKeyRef.current !== null;
      prevToolKeyRef.current = currentKey;
      if (changed) {
        clear();
        setPastedText('');
        setParamValues({});
        setAnalysisError(null);
        setIsAnalyzing(false);
      }
    }
  }, [tool?.key, clear]);

  // ---- Data input handlers ----

  const handleFileUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
          parse(text);
          message.success(`已加载文件: ${file.name}`);
        }
      };
      reader.onerror = () => {
        message.error('文件读取失败');
      };
      reader.readAsText(file, 'UTF-8');
      return false; // Prevent auto upload
    },
    [parse],
  );

  const handlePasteParse = useCallback(() => {
    if (!pastedText.trim()) {
      message.warning('请先粘贴数据');
      return;
    }
    parse(pastedText);
    message.success('数据解析成功');
  }, [pastedText, parse]);

  const handleLoadDemo = useCallback(() => {
    if (!tool) return;
    const demoData = generateDemoData(tool.key);
    const csvText = convertToCSV(demoData);
    setPastedText(csvText);
    parse(csvText);
    message.success('示例数据已加载');
  }, [tool, parse]);

  // ---- Parameter value change ----

  const handleParamChange = useCallback((key: string, value: unknown) => {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ---- Validate required params ----

  const missingRequiredParams = useMemo(() => {
    if (!tool) return [];
    return tool.parameters
      .filter((p) => p.required && !isSpecialTitleParam(p))
      .filter((p) => {
        const val = paramValues[p.key];
        if (val === undefined || val === null || val === '') return true;
        if (Array.isArray(val) && val.length === 0) return true;
        return false;
      })
      .map((p) => p.label);
  }, [tool, paramValues]);

  const canRun = parsedData.length > 0 && missingRequiredParams.length === 0 && !isAnalyzing;

  // ---- Run analysis ----

  const handleRunAnalysis = useCallback(async () => {
    if (!tool || !canRun) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const result = await analyzeBioData({
        tool_key: tool.key,
        data: parsedData,
        parameters: paramValues,
      });

      if (result.success) {
        onResult(result);
        message.success('分析完成');
      } else {
        setAnalysisError(result.error ?? result.message ?? '分析失败');
        message.error(result.error ?? result.message ?? '分析失败');
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : '分析请求失败，请检查网络连接';
      setAnalysisError(errorMsg);
      message.error(errorMsg);
    } finally {
      setIsAnalyzing(false);
    }
  }, [tool, canRun, parsedData, paramValues, onResult]);

  // ---- Render parameter input ----

  function renderParamInput(param: BioToolParameter) {
    const value = paramValues[param.key];
    const effectiveType = getEffectiveParamType(param);

    // Handle title as text input
    if (param.key === 'title' && param.type === 'columnSelect') {
      return (
        <Input
          placeholder="请输入图表标题"
          value={(value as string) ?? ''}
          onChange={(e) => handleParamChange(param.key, e.target.value)}
          allowClear
          style={{ width: '100%' }}
        />
      );
    }

    switch (effectiveType) {
      case 'columnSelect':
        return (
          <Select
            placeholder={`请选择${param.label}`}
            value={value ? String(value) : undefined}
            onChange={(v) => handleParamChange(param.key, v)}
            options={columns.map((col) => ({ value: col, label: col }))}
            allowClear
            showSearch
            style={{ width: '100%' }}
          />
        );

      case 'columnMultiSelect':
        return (
          <Select
            mode="multiple"
            placeholder={`请选择${param.label}`}
            value={Array.isArray(value) ? value.map(String) : (value ? [String(value)] : [])}
            onChange={(v) => handleParamChange(param.key, v)}
            options={columns.map((col) => ({ value: col, label: col }))}
            allowClear
            showSearch
            style={{ width: '100%' }}
          />
        );

      case 'number':
        return (
          <InputNumber
            placeholder={`请输入${param.label}`}
            value={value as number}
            onChange={(v) => handleParamChange(param.key, v)}
            style={{ width: '100%' }}
          />
        );

      case 'select':
        return (
          <Select
            placeholder={`请选择${param.label}`}
            value={value ? String(value) : undefined}
            onChange={(v) => handleParamChange(param.key, v)}
            options={param.options}
            allowClear
            style={{ width: '100%' }}
          />
        );

      default:
        return (
          <Input
            placeholder={`请输入${param.label}`}
            value={(value as string) ?? ''}
            onChange={(e) => handleParamChange(param.key, e.target.value)}
            style={{ width: '100%' }}
          />
        );
    }
  }

  // ---- Empty state ----

  if (!tool) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          minHeight: 400,
          color: '#999',
          fontSize: 16,
          padding: 48,
        }}
      >
        请从左侧选择一个分析工具
      </div>
    );
  }

  // ---- Data preview columns ----

  const previewColumns =
    columns.length > 0
      ? columns.map((col) => ({
          title: col,
          dataIndex: col,
          key: col,
          ellipsis: true,
          width: 150,
          render: (val: unknown) => {
            if (val === null || val === undefined) return <Text type="secondary">-</Text>;
            return String(val);
          },
        }))
      : [];

  // ---- Table data source (first 10 rows) ----

  const dataSource = parsedData.slice(0, 10).map((row, idx) => ({ ...row, _key: idx }));

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: 24,
      }}
    >
      {/* ---- Tool Header ---- */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          {tool.name}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 8 }}>
          {tool.description}
        </Paragraph>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <InfoCircleOutlined style={{ marginRight: 4 }} />
          数据要求：{tool.dataRequirements}
        </Text>
      </div>

      {/* ---- Data Input Section ---- */}
      <Card
        title="数据输入"
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'upload',
              label: '上传文件',
              children: (
                <Dragger
                  accept=".csv,.xlsx,.txt,.tsv"
                  multiple={false}
                  showUploadList={false}
                  beforeUpload={handleFileUpload}
                >
                  <p className="ant-upload-drag-icon">
                    <UploadOutlined style={{ fontSize: 36, color: '#1677ff' }} />
                  </p>
                  <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                  <p className="ant-upload-hint">支持 .csv、.xlsx、.txt、.tsv 格式</p>
                </Dragger>
              ),
            },
            {
              key: 'paste',
              label: '粘贴数据',
              children: (
                <div>
                  <TextArea
                    rows={12}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder={
                      '在此粘贴CSV或TSV格式的数据...\n\n示例：\n分组,数值,类别\n对照组,25.3,A\n治疗组,18.5,B'
                    }
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                  <div style={{ marginTop: 12 }}>
                    <Button type="primary" onClick={handlePasteParse}>
                      解析数据
                    </Button>
                  </div>
                </div>
              ),
            },
            {
              key: 'demo',
              label: '示例数据',
              children: (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                    加载预生成的示例数据，快速体验 {tool.name} 功能
                  </Paragraph>
                  <Button onClick={handleLoadDemo}>加载示例数据</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* ---- Parse Error ---- */}
      {parseError && (
        <Alert
          message="数据解析错误"
          description={parseError}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ---- Data Preview ---- */}
      {parsedData.length > 0 && (
        <Card
          title={`数据预览（共 ${parsedData.length} 行，${columns.length} 列）`}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Table
            columns={previewColumns}
            dataSource={dataSource}
            rowKey="_key"
            pagination={false}
            scroll={{ x: 'max-content' }}
            size="small"
            bordered
          />
          {parsedData.length > 10 && (
            <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
              仅显示前 10 行
            </Text>
          )}
        </Card>
      )}

      {/* ---- Parameter Configuration ---- */}
      {parsedData.length > 0 && (
        <Card
          title="参数配置"
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Form layout="vertical">
            {tool.parameters.map((param) => {
              const label = (
                <span>
                  {param.required && <Text type="danger">* </Text>}
                  {param.label}
                  {param.description && (
                    <Tooltip title={param.description}>
                      <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
                    </Tooltip>
                  )}
                </span>
              );

              return (
                <Form.Item
                  key={param.key}
                  label={label}
                  required={param.required && !isSpecialTitleParam(param)}
                >
                  {renderParamInput(param)}
                </Form.Item>
              );
            })}
          </Form>
        </Card>
      )}

      {/* ---- Missing Required Parameters Warning ---- */}
      {parsedData.length > 0 && missingRequiredParams.length > 0 && (
        <Alert
          message="缺少必填参数"
          description={
            <>
              请填写以下必填参数：{missingRequiredParams.map((l) => (
                <Tag key={l} color="red" style={{ marginLeft: 4 }}>
                  {l}
                </Tag>
              ))}
            </>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ---- Analysis Error ---- */}
      {analysisError && (
        <Alert
          message="分析失败"
          description={analysisError}
          type="error"
          showIcon
          closable
          onClose={() => setAnalysisError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ---- Run Button ---- */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Button
          type="primary"
          size="large"
          icon={<PlayCircleOutlined />}
          loading={isAnalyzing}
          disabled={!canRun}
          onClick={handleRunAnalysis}
          style={{ minWidth: 160 }}
        >
          {isAnalyzing ? '分析中...' : '运行分析'}
        </Button>
        {parsedData.length === 0 && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">请先加载数据</Text>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility: convert array of records to CSV string
// ---------------------------------------------------------------------------

function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const lines = [headers.join(',')];
  for (const row of data) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Quote strings containing commas or quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(','));
  }
  return lines.join('\n');
}
