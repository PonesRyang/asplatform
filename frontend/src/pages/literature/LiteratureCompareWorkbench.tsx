// @ts-nocheck
import { useState, useCallback } from 'react';
import {
  Row,
  Col,
  Card,
  Upload,
  Button,
  Select,
  Typography,
  message,
  Spin,
  Empty,
  Tag,
  Space,
  Alert,
  Divider,
} from 'antd';
import {
  InboxOutlined,
  DeleteOutlined,
  SwapOutlined,
  FileTextOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import type { UploadFile, RcFile } from 'antd/es/upload';
import * as literatureApi from '../../services/literatureApi';
import type { DocumentItem } from '../../types/literature';

const { Dragger } = Upload;
const { Title, Paragraph, Text } = Typography;

// ---------------------------------------------------------------------------
// Simple markdown-to-JSX renderer
// ---------------------------------------------------------------------------
function renderMarkdown(md: string): React.ReactNode {
  const lines = md.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 8 }} />);
      i++;
      continue;
    }

    // Heading 3 (###)
    if (line.startsWith('### ')) {
      elements.push(
        <Title key={i} level={5} style={{ marginTop: 16, marginBottom: 4 }}>
          {line.slice(4)}
        </Title>,
      );
      i++;
      continue;
    }

    // Heading 2 (##)
    if (line.startsWith('## ')) {
      elements.push(
        <Title key={i} level={4} style={{ marginTop: 12, marginBottom: 4 }}>
          {line.slice(3)}
        </Title>,
      );
      i++;
      continue;
    }

    // Heading 1 (#)
    if (line.startsWith('# ')) {
      elements.push(
        <Title key={i} level={3} style={{ marginTop: 16, marginBottom: 4 }}>
          {line.slice(2)}
        </Title>,
      );
      i++;
      continue;
    }

    // Bold (**text**)
    let content: React.ReactNode = line;
    const boldRegex = /\*\*(.+?)\*\*/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = boldRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      parts.push(<strong key={`${i}-${match.index}`}>{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }
    content = parts.length > 0 ? parts : line;

    // Unordered list
    if (/^[\-\*]\s/.test(line)) {
      elements.push(
        <Paragraph key={i} style={{ marginBottom: 4, paddingLeft: 20 }}>
          • {line.replace(/^[\-\*]\s/, '')}
        </Paragraph>,
      );
    } else if (/^\d+[\.\)]\s/.test(line)) {
      elements.push(
        <Paragraph key={i} style={{ marginBottom: 4, paddingLeft: 20 }}>
          {line}
        </Paragraph>,
      );
    } else {
      elements.push(
        <Paragraph key={i} style={{ marginBottom: 4 }}>
          {content}
        </Paragraph>,
      );
    }
    i++;
  }

  return <div>{elements}</div>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getPreview(doc: DocumentItem): string {
  const text = doc.content || doc.abstract || '';
  return text.length > 300 ? text.slice(0, 300) + '...' : text;
}

function isPDFWordOrTxt(file: RcFile): boolean {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  return allowed.includes(file.type);
}

function extractResultString(data: Record<string, unknown>): string {
  if (typeof data.result === 'string') return data.result;
  if (typeof data.comparison === 'string') return data.comparison;
  if (typeof data.analysis === 'string') return data.analysis;
  if (typeof data.gap_analysis === 'string') return data.gap_analysis;
  if (typeof data.data === 'string') return data.data;
  // Fallback: stringify everything
  return JSON.stringify(data, null, 2);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function LiteratureCompareWorkbench() {
  // ---- Upload / extraction state ------------------------------------------
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [extractedDocs, setExtractedDocs] = useState<DocumentItem[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  // ---- Comparison state ---------------------------------------------------
  const [compareResult, setCompareResult] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // ---- Gap analysis state -------------------------------------------------
  const [startDocIndex, setStartDocIndex] = useState<number | undefined>(
    undefined,
  );
  const [endDocIndex, setEndDocIndex] = useState<number | undefined>(undefined);
  const [gapResult, setGapResult] = useState<string | null>(null);
  const [isGapAnalyzing, setIsGapAnalyzing] = useState(false);

  // ---- Handlers -----------------------------------------------------------

  /** Upload files, extract text via API */
  const handleUpload = useCallback(
    (file: RcFile): false => {
      // Guard: max 3 files
      if (fileList.length >= 3) {
        message.warning('最多上传3篇文献');
        return false;
      }
      // Guard: duplicate
      if (
        fileList.some(
          (f) => f.name === file.name && f.size === file.size,
        )
      ) {
        message.warning(`文件 "${file.name}" 已存在`);
        return false;
      }

      const newUploadFile: UploadFile = {
        uid: file.uid || `${Date.now()}-${file.name}`,
        name: file.name,
        status: 'uploading',
        originFileObj: file,
      };

      // Add to UI list immediately
      const updatedFileList = [...fileList, newUploadFile];
      setFileList(updatedFileList);

      // Extract files
      const rawFiles: File[] = updatedFileList
        .map((uf) => uf.originFileObj)
        .filter((f): f is File => f instanceof File);

      setIsExtracting(true);
      literatureApi
        .extractLitFiles(rawFiles)
        .then((docs) => {
          setExtractedDocs(docs);
          setFileList((prev) =>
            prev.map((uf) => ({ ...uf, status: 'done' as const })),
          );
          message.success(`成功提取 ${docs.length} 篇文献内容`);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : '未知错误';
          message.error('文献提取失败: ' + msg);
          setFileList((prev) =>
            prev.map((uf) =>
              uf.uid === newUploadFile.uid
                ? { ...uf, status: 'error' as const }
                : uf,
            ),
          );
        })
        .finally(() => setIsExtracting(false));

      return false;
    },
    [fileList],
  );

  /** Remove a file */
  const handleRemove = useCallback(
    (uid: string) => {
      setFileList((prev) => prev.filter((f) => f.uid !== uid));
      const remaining = fileList.filter((f) => f.uid !== uid);
      const rawFiles = remaining
        .map((uf) => uf.originFileObj)
        .filter(Boolean) as File[];

      if (rawFiles.length > 0) {
        setIsExtracting(true);
        literatureApi
          .extractLitFiles(rawFiles)
          .then((docs) => {
            setExtractedDocs(docs);
            message.success(`剩余 ${docs.length} 篇文献`);
          })
          .catch(() => message.error('更新文献列表失败'))
          .finally(() => setIsExtracting(false));
      } else {
        setExtractedDocs([]);
        setCompareResult(null);
        setGapResult(null);
        setStartDocIndex(undefined);
        setEndDocIndex(undefined);
      }
    },
    [fileList],
  );

  /** Trigger comparison */
  const handleCompare = useCallback(async () => {
    if (extractedDocs.length < 2) {
      message.warning('请至少上传2篇文献后再进行对比分析');
      return;
    }
    setIsComparing(true);
    setCompareResult(null);
    setGapResult(null);
    try {
      const data = await literatureApi.compareLiterature(extractedDocs);
      const result = extractResultString(data);
      setCompareResult(result);
      message.success('对比分析完成');
      // Reset gap analysis when a new comparison is run
      setStartDocIndex(undefined);
      setEndDocIndex(undefined);
      setGapResult(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      message.error('对比分析失败: ' + msg);
    } finally {
      setIsComparing(false);
    }
  }, [extractedDocs]);

  /** Trigger gap analysis */
  const handleGapAnalysis = useCallback(async () => {
    if (
      startDocIndex === undefined ||
      endDocIndex === undefined ||
      !compareResult
    ) {
      message.warning('请选择起点文献和终点文献');
      return;
    }
    if (startDocIndex === endDocIndex) {
      message.warning('起点文献和终点文献不能相同');
      return;
    }

    setIsGapAnalyzing(true);
    setGapResult(null);
    try {
      const startDoc = extractedDocs[startDocIndex];
      const endDoc = extractedDocs[endDocIndex];
      const data = await literatureApi.gapAnalysis({
        documents: [startDoc, endDoc],
        research_area: compareResult,
        instructions: `起点文献: ${startDoc.title}, 终点文献: ${endDoc.title}`,
      });
      const result = extractResultString(data);
      setGapResult(result);
      message.success('差距规划已生成');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      message.error('差距分析失败: ' + msg);
    } finally {
      setIsGapAnalyzing(false);
    }
  }, [startDocIndex, endDocIndex, compareResult, extractedDocs]);

  // ---- Derived ------------------------------------------------------------
  const canCompare = extractedDocs.length >= 2 && !isComparing && !isExtracting;
  const canGapAnalyze =
    startDocIndex !== undefined &&
    endDocIndex !== undefined &&
    !!compareResult &&
    !isGapAnalyzing;
  const docOptions = extractedDocs.map((doc, idx) => ({
    value: idx,
    label: doc.title || `文献 ${idx + 1}`,
  }));

  // ---- Render -------------------------------------------------------------
  return (
    <div>
      <Title level={2} style={{ marginBottom: 4 }}>
        文献对比分析
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        上传多篇文献，AI 帮你对比分析异同点，并规划从当前水平到目标水平的研究路径
      </Paragraph>

      <Row gutter={24}>
        {/* ================================================================ */}
        {/* Left column — Upload & File management                          */}
        {/* ================================================================ */}
        <Col xs={24} lg={10}>
          <Card
            title="上传文献"
            styles={{ body: { padding: 24 } }}
          >
            <Paragraph type="secondary">
              上传2-3篇文献，AI会对比分析并帮你规划研究路径
            </Paragraph>

            {/* Dragger */}
            <Dragger
              accept=".pdf,.doc,.docx,.txt"
              multiple
              maxCount={3}
              showUploadList={false}
              beforeUpload={(file) => {
                if (!isPDFWordOrTxt(file)) {
                  message.error('仅支持 PDF、Word、TXT 格式');
                  return Upload.LIST_IGNORE;
                }
                if (file.size > 20 * 1024 * 1024) {
                  message.error('文件大小不能超过 20MB');
                  return Upload.LIST_IGNORE;
                }
                handleUpload(file);
                return false;
              }}
              disabled={isExtracting || isComparing}
              style={{ marginBottom: 16 }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持 PDF、Word、TXT 格式，最多 3 篇文献，单文件不超过 20MB
              </p>
            </Dragger>

            {/* Extracting spinner */}
            {isExtracting && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Spin tip="正在提取文献内容..." />
              </div>
            )}

            {/* Uploaded file cards */}
            {fileList.length > 0 && !isExtracting && (
              <div style={{ marginTop: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  已上传文献 ({fileList.length}/3)
                </Text>
                {fileList.map((file, idx) => {
                  const doc = extractedDocs[idx];
                  const preview = doc ? getPreview(doc) : '';
                  return (
                    <Card
                      key={file.uid}
                      size="small"
                      style={{ marginBottom: 8 }}
                      type="inner"
                      title={
                        <Space>
                          <FileTextOutlined />
                          <Text
                            ellipsis={{ tooltip: file.name }}
                            style={{ maxWidth: 200 }}
                          >
                            {file.name}
                          </Text>
                          {file.status === 'done' && (
                            <Tag color="green">已提取</Tag>
                          )}
                          {file.status === 'error' && (
                            <Tag color="red">提取失败</Tag>
                          )}
                        </Space>
                      }
                      extra={
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemove(file.uid)}
                          disabled={isComparing || isGapAnalyzing}
                        />
                      }
                    >
                      {preview ? (
                        <Paragraph
                          type="secondary"
                          style={{
                            fontSize: 12,
                            marginBottom: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            maxHeight: 80,
                            overflow: 'hidden',
                          }}
                        >
                          {preview}
                        </Paragraph>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          暂无预览
                        </Text>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Compare button */}
            <Button
              type="primary"
              size="large"
              block
              icon={<SwapOutlined />}
              onClick={handleCompare}
              disabled={!canCompare}
              loading={isComparing}
              style={{ marginTop: 16 }}
            >
              {isComparing ? '正在对比分析...' : '开始对比分析'}
            </Button>
          </Card>
        </Col>

        {/* ================================================================ */}
        {/* Right column — Results                                          */}
        {/* ================================================================ */}
        <Col xs={24} lg={14}>
          {/* Comparison result */}
          {compareResult ? (
            <Card
              title="对比分析结果"
              style={{ marginBottom: 24 }}
              styles={{ body: { maxHeight: 500, overflow: 'auto' } }}
            >
              {renderMarkdown(compareResult)}
            </Card>
          ) : !isComparing && (
            <Card style={{ marginBottom: 24 }}>
              <Empty description="上传文献并点击「开始对比分析」查看结果" />
            </Card>
          )}

          {isComparing && (
            <Card style={{ marginBottom: 24 }}>
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="large" tip="AI 正在分析文献，请稍候..." />
              </div>
            </Card>
          )}

          {/* Gap analysis section — only shown after comparison */}
          {compareResult && (
            <>
              <Divider orientation="left">
                <Text strong>研究差距规划</Text>
              </Divider>

              <Card style={{ marginBottom: 24 }}>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>起点文献（当前水平）</Text>
                    </div>
                    <Select
                      placeholder="请选择起点文献"
                      style={{ width: '100%' }}
                      options={docOptions}
                      value={startDocIndex}
                      onChange={setStartDocIndex}
                      disabled={isGapAnalyzing}
                    />
                  </Col>
                  <Col xs={24} sm={12}>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>终点文献（目标水平）</Text>
                    </div>
                    <Select
                      placeholder="请选择终点文献"
                      style={{ width: '100%' }}
                      options={docOptions}
                      value={endDocIndex}
                      onChange={setEndDocIndex}
                      disabled={isGapAnalyzing}
                    />
                  </Col>
                </Row>

                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<ArrowRightOutlined />}
                  onClick={handleGapAnalysis}
                  disabled={!canGapAnalyze}
                  loading={isGapAnalyzing}
                  style={{ marginTop: 16 }}
                >
                  {isGapAnalyzing ? '正在生成差距规划...' : '生成差距规划'}
                </Button>
              </Card>

              {/* Gap analysis progress */}
              {isGapAnalyzing && (
                <Card style={{ marginBottom: 24 }}>
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Spin size="large" tip="AI 正在生成研究差距规划，请稍候..." />
                  </div>
                </Card>
              )}

              {/* Gap analysis result */}
              {gapResult && !isGapAnalyzing && (
                <Card
                  title="差距分析结果"
                  styles={{
                    body: { maxHeight: 600, overflow: 'auto' },
                  }}
                >
                  {renderMarkdown(gapResult)}
                </Card>
              )}

              {/* Warning if selects chosen but no result yet */}
              {!gapResult &&
                !isGapAnalyzing &&
                startDocIndex !== undefined &&
                endDocIndex !== undefined &&
                startDocIndex !== endDocIndex && (
                  <Alert
                    type="info"
                    message="已选择起点和终点文献"
                    description="点击「生成差距规划」按钮，AI 将为你生成详细的研究路径规划"
                    showIcon
                  />
                )}
            </>
          )}
        </Col>
      </Row>
    </div>
  );
}
