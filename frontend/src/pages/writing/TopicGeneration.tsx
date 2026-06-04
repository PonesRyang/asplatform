// @ts-nocheck
import { useState, type FC } from 'react';
import {
  Card, Form, Select, Input, InputNumber, Button, Typography, Space, Row, Col,
  Spin, Empty, message, Modal, List, Tag, Progress, Collapse,
} from 'antd';
import {
  BulbOutlined, ReloadOutlined, CheckCircleOutlined,
  BarChartOutlined, ThunderboltOutlined, PlusOutlined, SearchOutlined,
  LinkOutlined, BookOutlined, FileTextOutlined, TrophyOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  generateTopics,
  analyzeTopic,
  refineTopic,
  createAndOutline,
} from '../../services/topicApi';
import { DISCIPLINES, THESIS_TYPES, LENGTH_OPTIONS, LANGUAGES } from '../../config/constants';
import type { TopicGenerationRequest, TopicAnalysisRequest, TopicRefineRequest, ThesisCreateRequest, ThesisProject } from '../../types/thesis';

const { Text, Title, Paragraph } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TopicCardData {
  title: string;
  discipline_field?: string;
  research_hotspot?: string;
  innovation_level?: string;
  difficulty_level?: string;
  feasibility?: string;
  description?: string;
  extended_directions?: string[];
}

interface TopicGenerationProps {
  serviceToken: string;
  onTopicSelected: (project: ThesisProject) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'green',
  medium: 'orange',
  hard: 'red',
};

const FEASIBILITY_COLORS: Record<string, string> = {
  high: 'green',
  medium: 'orange',
  low: 'red',
};

function difficultyColor(level: string): string {
  const d = String(level ?? '');
  if (d.includes('低') || d.includes('容易') || d.toLowerCase() === 'easy') return 'green';
  if (d.includes('中') || d.toLowerCase() === 'medium') return 'orange';
  if (d.includes('高') || d.includes('难') || d.toLowerCase() === 'hard') return 'red';
  return 'default';
}

function feasibilityColor(level: string): string {
  const f = String(level ?? '');
  if (f.includes('高') || f.toLowerCase() === 'high') return 'green';
  if (f.includes('中') || f.toLowerCase() === 'medium') return 'orange';
  if (f.includes('低') || f.toLowerCase() === 'low') return 'red';
  return 'default';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const TopicGeneration: FC<TopicGenerationProps> = ({ serviceToken, onTopicSelected }) => {
  const [form] = Form.useForm();
  
  // State
  const [generating, setGenerating] = useState(false);
  const [topics, setTopics] = useState<TopicCardData[]>([]);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<Record<string, unknown> | null>(null);
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);

  const [refining, setRefining] = useState(false);
  const [refineModalOpen, setRefineModalOpen] = useState(false);
  const [refineTopicTitle, setRefineTopicTitle] = useState('');
  const [refineInstructions, setRefineInstructions] = useState('');

  const [creatingProject, setCreatingProject] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [createForm] = Form.useForm();

  // -------------------------------------------------------------------------
  // Generate topics
  // -------------------------------------------------------------------------
  const handleGenerate = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      setGenerating(true);
      setTopics([]);

      const request: TopicGenerationRequest = {
        token: serviceToken,
        discipline: values.discipline,
        research_direction: values.direction || undefined,
        keywords: values.keywords ? values.keywords.split(',').map((s: string) => s.trim()) : undefined,
        count: values.count || 5,
      };

      const result = await generateTopics(request);
      const topicList = (result.topics ?? []) as TopicCardData[];
      setTopics(topicList);

      if (topicList.length === 0) {
        message.info('未生成选题，请调整参数后重试');
      } else {
        message.success(`成功生成 ${topicList.length} 个选题`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成选题失败';
      message.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  // -------------------------------------------------------------------------
  // Analyze topic
  // -------------------------------------------------------------------------
  const handleAnalyze = async (topicTitle: string): Promise<void> => {
    setAnalyzing(topicTitle);
    try {
      const request: any = {
        token: serviceToken,
        topic: topicTitle,
        discipline: form.getFieldValue('discipline') || '',
      };
      const data = await analyzeTopic(request);
      setAnalysisData(data);
      setAnalysisModalOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '分析失败';
      message.error(msg);
    } finally {
      setAnalyzing(null);
    }
  };

  // -------------------------------------------------------------------------
  // Refine topic
  // -------------------------------------------------------------------------
  const handleOpenRefine = (topicTitle: string): void => {
    setRefineTopicTitle(topicTitle);
    setRefineInstructions('');
    setRefineModalOpen(true);
  };

  const handleRefine = async (): Promise<void> => {
    if (!refineInstructions.trim()) {
      message.warning('请输入细化需求');
      return;
    }
    setRefining(true);
    try {
      const request: any = {
        token: serviceToken,
        topic: refineTopicTitle,
        discipline: form.getFieldValue('discipline') || '',
        requirements: refineInstructions.trim(),
      };
      const result: any = await refineTopic(request);

      // Replace the original topic with refined one
      setTopics((prev) =>
        prev.map((t) =>
          t.title === refineTopicTitle
            ? { ...result }
            : t,
        ),
      );
      message.success('选题已细化');
      setRefineModalOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '细化失败';
      message.error(msg);
    } finally {
      setRefining(false);
    }
  };

  // -------------------------------------------------------------------------
  // Select topic and create project
  // -------------------------------------------------------------------------
  const handleOpenCreate = (topicTitle: string): void => {
    setSelectedTopic(topicTitle);
    createForm.resetFields();
    setCreateModalOpen(true);
  };

  const handleCreateProject = async (): Promise<void> => {
    try {
      const values = await createForm.validateFields();
      setCreatingProject(true);

      const request: any = {
        token: serviceToken,
        topic_title: selectedTopic,
        discipline: values.discipline,
        thesis_type: values.thesis_type,
        language: values.language,
        length: values.length,
      };

      const project = await createAndOutline(request);
      message.success('项目已创建，开始生成提纲...');
      setCreateModalOpen(false);
      onTopicSelected(project);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '创建项目失败';
      message.error(msg);
    } finally {
      setCreatingProject(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render analysis content — structured display
  // -------------------------------------------------------------------------
  const renderAnalysisContent = (): React.ReactNode => {
    if (!analysisData) return <Empty description="无分析数据" />;
    const d: any = analysisData;

    return (
      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {/* 相似度 */}
        {d.overall_similarity != null && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>选题相似度</Text>
            <Progress percent={d.overall_similarity} size="small"
              status={d.overall_similarity > 70 ? 'exception' : d.overall_similarity > 40 ? 'active' : 'success'} />
          </div>
        )}

        {/* 创新点分析 */}
        {d.analysis && (
          <Card size="small" title={<><TrophyOutlined /> 创新性分析</>} style={{ marginBottom: 12 }}>
            {d.analysis.innovation && <Paragraph>{d.analysis.innovation}</Paragraph>}
            {d.analysis.scientific_value && <Paragraph><Text strong>科学价值：</Text>{d.analysis.scientific_value}</Paragraph>}
            {d.analysis.practical_significance && <Paragraph><Text strong>实践意义：</Text>{d.analysis.practical_significance}</Paragraph>}
          </Card>
        )}

        {/* 研究背景 */}
        {d.research_background && (
          <Card size="small" title={<><BookOutlined /> 研究背景</>} style={{ marginBottom: 12 }}>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{d.research_background}</Paragraph>
          </Card>
        )}

        {/* 研究意义 */}
        {d.research_significance && (
          <Card size="small" title="研究意义" style={{ marginBottom: 12 }}>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{d.research_significance}</Paragraph>
          </Card>
        )}

        {/* 可行性分析 */}
        {d.feasibility_analysis && (
          <Card size="small" title="可行性分析" style={{ marginBottom: 12 }}>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{d.feasibility_analysis}</Paragraph>
          </Card>
        )}

        {/* 潜在创新点 */}
        {d.potential_innovations?.length > 0 && (
          <Card size="small" title="潜在创新点" style={{ marginBottom: 12 }}>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {d.potential_innovations.map((item: string, i: number) => (
                <li key={i} style={{ marginBottom: 4 }}>{item}</li>
              ))}
            </ul>
          </Card>
        )}

        {/* 扩展方向 */}
        {d.extended_directions?.length > 0 && (
          <Card size="small" title="扩展研究方向" style={{ marginBottom: 12 }}>
            <Space wrap>
              {d.extended_directions.map((item: string, i: number) => (
                <Tag key={i} color="blue">{item}</Tag>
              ))}
            </Space>
          </Card>
        )}

        {/* 相似论文 */}
        {d.similar_papers?.length > 0 && (
          <Card size="small" title={<><FileTextOutlined /> 相似论文</>} style={{ marginBottom: 12 }}>
            {d.similar_papers.map((p: any, i: number) => (
              <div key={i} style={{ marginBottom: 8, padding: 8, background: '#fafafa', borderRadius: 6 }}>
                <Text strong>{p.title}</Text><br />
                <Text type="secondary">{p.authors} · {p.journal} ({p.year})</Text>
                {p.similarity && <Tag color="orange" style={{ marginLeft: 8 }}>相似度 {p.similarity}%</Tag>}
                {p.link && <a href={p.link} target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}><LinkOutlined /></a>}
              </div>
            ))}
          </Card>
        )}

        {/* 推荐参考文献 */}
        {d.recommended_references?.length > 0 && (
          <Card size="small" title="推荐参考文献" style={{ marginBottom: 12 }}>
            {d.recommended_references.map((ref: any, i: number) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <Text>{i + 1}. {ref.authors} ({ref.year}). {ref.title}. {ref.source}.</Text>
                {ref.link && <a href={ref.link} target="_blank" rel="noreferrer" style={{ marginLeft: 4 }}><LinkOutlined /></a>}
              </div>
            ))}
          </Card>
        )}

        {/* 真实文献 */}
        {d.real_literature?.length > 0 && (
          <Collapse size="small" ghost items={[{
            key: 'real', label: `真实文献检索结果（${d.real_literature.length} 篇）`,
            children: d.real_literature.map((cit: any, i: number) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <Text>{i + 1}. {cit.formatted || cit.title}</Text>
                {cit.link && <a href={cit.link} target="_blank" rel="noreferrer" style={{ marginLeft: 4 }}><LinkOutlined /></a>}
              </div>
            ))
          }]} />
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* ---- Generation Form ---- */}
      <Card
        title={
          <Space>
            <BulbOutlined style={{ color: '#faad14' }} />
            <span>智能选题</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            discipline: undefined,
            thesis_type: 'bachelor',
            count: 5,
          }}
        >
          <Row gutter={24}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="discipline"
                label="学科领域"
                rules={[{ required: true, message: '请选择学科' }]}
              >
                <Select
                  placeholder="请选择学科领域"
                  showSearch
                  optionFilterProp="label"
                  options={DISCIPLINES.map((d) => ({
                    value: d.value,
                    label: d.label,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="thesis_type"
                label="论文类型"
                rules={[{ required: true, message: '请选择论文类型' }]}
              >
                <Select
                  placeholder="请选择论文类型"
                  options={THESIS_TYPES.map((t) => ({
                    value: t.value,
                    label: t.label,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} sm={12}>
              <Form.Item name="direction" label="研究方向">
                <Input placeholder="例如：深度学习在医学影像中的应用" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="keywords" label="关键词">
                <Input placeholder="多个关键词用逗号分隔" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={4}>
              <Form.Item name="count" label="选题数量">
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              size="large"
              icon={<SearchOutlined />}
              onClick={handleGenerate}
              loading={generating}
            >
              生成选题
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* ---- Results ---- */}
      {generating && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="正在分析学科前沿，生成选题建议..." />
        </div>
      )}

      {!generating && topics.length > 0 && (
        <>
          <Title level={5} style={{ marginBottom: 16 }}>
            选题结果（{topics.length} 个）
          </Title>
          <List
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 2, xxl: 3 }}
            dataSource={topics}
            renderItem={(topic) => (
              <List.Item key={topic.title}>
                <Card
                  hoverable
                  style={{ height: '100%' }}
                  styles={{ body: { padding: 20 } }}
                >
                  {/* Topic title */}
                  <Title level={5} style={{ marginBottom: 8, lineHeight: 1.5 }}>
                    {topic.title}
                  </Title>

                  {/* Meta info */}
                  <Space size={4} wrap style={{ marginBottom: 8 }}>
                    {topic.discipline_field && (
                      <Text type="secondary" style={{ fontSize: 12 }}>{topic.discipline_field}</Text>
                    )}
                    {topic.innovation_level && (
                      <Text type="secondary" style={{ fontSize: 12 }}>创新度: {topic.innovation_level}</Text>
                    )}
                    {topic.difficulty_level && (
                      <Text type="secondary" style={{ fontSize: 12 }}>难度: {topic.difficulty_level}</Text>
                    )}
                  </Space>

                  {/* Description */}
                  {topic.description && (
                    <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 12, fontSize: 13, color: '#666' }}>
                      {topic.description}
                    </Paragraph>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button size="small" type="default" icon={<BarChartOutlined />}
                      loading={analyzing === topic.title}
                      onClick={() => handleAnalyze(topic.title)}>分析</Button>
                    <Button size="small" type="default" icon={<ThunderboltOutlined />}
                      onClick={() => handleOpenRefine(topic.title)}>细化</Button>
                    <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                      onClick={() => handleOpenCreate(topic.title)}>选择此题目</Button>
                  </div>
                </Card>
              </List.Item>
            )}
          />

          {/* Regenerate link */}
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Button
              type="link"
              icon={<ReloadOutlined />}
              onClick={handleGenerate}
              loading={generating}
            >
              再生成一批
            </Button>
          </div>
        </>
      )}

      {!generating && topics.length === 0 && <></>}

      {/* ---- Analysis Modal ---- */}
      <Modal
        title={
          <Space>
            <BarChartOutlined />
            <span>选题分析</span>
          </Space>
        }
        open={analysisModalOpen}
        onCancel={() => setAnalysisModalOpen(false)}
        footer={
          <Button onClick={() => setAnalysisModalOpen(false)}>关闭</Button>
        }
        width={700}
        centered
        destroyOnClose
      >
        {renderAnalysisContent()}
      </Modal>

      {/* ---- Refine Modal ---- */}
      <Modal
        title={
          <Space>
            <ThunderboltOutlined />
            <span>细化选题</span>
          </Space>
        }
        open={refineModalOpen}
        onCancel={() => setRefineModalOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setRefineModalOpen(false)}>取消</Button>
            <Button
              type="primary"
              loading={refining}
              onClick={handleRefine}
            >
              确认细化
            </Button>
          </Space>
        }
        centered
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>原选题：</Text>
          <Paragraph style={{ marginTop: 4 }}>{refineTopicTitle}</Paragraph>
        </div>
        <div>
          <Text strong>细化需求：</Text>
          <Input.TextArea
            rows={4}
            placeholder="请描述您希望如何细化或调整此选题，例如：更关注实践应用、缩小研究范围、增加理论深度等"
            value={refineInstructions}
            onChange={(e) => setRefineInstructions(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>

      {/* ---- Create Project Modal ---- */}
      <Modal
        title={
          <Space>
            <PlusOutlined />
            <span>创建论文项目</span>
          </Space>
        }
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setCreateModalOpen(false)}>取消</Button>
            <Button
              type="primary"
              loading={creatingProject}
              onClick={handleCreateProject}
            >
              创建项目并生成提纲
            </Button>
          </Space>
        }
        centered
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>已选题目：</Text>
          <Paragraph style={{ marginTop: 4 }}>{selectedTopic}</Paragraph>
        </div>
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{
            thesis_type: 'bachelor',
            language: 'zh',
            length: 'medium',
          }}
        >
          <Form.Item
            name="discipline"
            label="学科领域"
            rules={[{ required: true, message: '请选择学科' }]}
          >
            <Select
              placeholder="请选择学科领域"
              showSearch
              optionFilterProp="label"
              options={DISCIPLINES.map((d) => ({
                value: d.value,
                label: d.label,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="thesis_type"
            label="论文类型"
            rules={[{ required: true, message: '请选择论文类型' }]}
          >
            <Select
              options={THESIS_TYPES.map((t) => ({
                value: t.value,
                label: t.label,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="language"
            label="写作语言"
            rules={[{ required: true, message: '请选择语言' }]}
          >
            <Select
              options={LANGUAGES.map((l) => ({
                value: l.value,
                label: l.label,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="length"
            label="预期篇幅"
            rules={[{ required: true, message: '请选择篇幅' }]}
          >
            <Select
              options={LENGTH_OPTIONS.map((l) => ({
                value: l.value,
                label: l.label,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TopicGeneration;
