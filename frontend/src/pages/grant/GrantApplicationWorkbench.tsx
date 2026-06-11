import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Cascader,
  Col,
  Descriptions,
  Divider,
  Form,
  Input,
  List,
  message,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Steps,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { grantSteps } from './grantFlowConfig';
import type { GrantCandidateTopic, GrantConfigOptions, GrantInputState, GrantProject, GrantProposalSection, GrantReference, GrantReportVersion, GrantStepKey } from '../../types/grant';
import { useServiceToken } from '../../hooks/useServiceToken';
import {
  createGrantProject,
  exportGrantProposalWord,
  generateGrantKeywords,
  generateGrantProposal,
  generateGrantReport,
  generateGrantTopics,
  getGrantConfigOptions,
  getGrantProject,
  getGrantReportHistory,
  listGrantProjects,
  searchGrantReferences,
  selectGrantTopic,
  updateGrantProject,
} from '../../services/grantApi';
import type { GrantProjectSummary } from '../../services/grantApi';
import { downloadBlob } from '../../utils/download';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

const validSteps = grantSteps.map(step => step.key);

const emptyGrantProject: GrantProject = {
  id: 0,
  title: '未命名申报项目',
  status: 'draft',
  currentStep: 'input',
  input: {
    fundType: '国自然-青年基金',
    researchAreaPath: [],
    subject: '',
    diseasePath: [],
    phenotype: '',
    variableType: '',
    variableName: '',
  },
  keywords: { must: [], should: [], groups: [] },
  references: [],
  topics: [],
  reportSections: [],
  proposalSections: [],
  updatedAt: '',
};

const emptyConfigOptions: GrantConfigOptions = {
  fundTypes: [],
  researchAreas: [],
  diseases: [],
  variableTypes: [],
  phenotypes: [],
};

function getStepFromPath(pathname: string): GrantStepKey {
  const segment = pathname.split('/').filter(Boolean).pop();
  return validSteps.includes(segment as GrantStepKey) ? segment as GrantStepKey : 'input';
}

function getStepIndex(stepKey: GrantStepKey) {
  return grantSteps.findIndex(step => step.key === stepKey);
}

function scoreColor(score: number) {
  if (score >= 85) return '#0f8f6f';
  if (score >= 75) return '#2458d3';
  return '#a16207';
}

function referenceMeta(reference: GrantReference) {
  return [
    reference.journal,
    reference.year ? String(reference.year) : '',
    reference.pmid ? `PMID ${reference.pmid}` : '',
    reference.doi ? `DOI ${reference.doi}` : '',
    reference.database,
  ].filter(Boolean).join(' · ');
}

function SectionCard(props: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <Card
      title={props.title}
      extra={props.extra}
      style={{ borderRadius: 8, marginBottom: 16 }}
      styles={{ body: { padding: 18 } }}
    >
      {props.children}
    </Card>
  );
}

function ProjectHeader({
  project,
  currentStep,
  onStepChange,
  onBackList,
  onExport,
  loading,
}: {
  project: GrantProject;
  currentStep: GrantStepKey;
  onStepChange: (step: GrantStepKey) => void;
  onBackList: () => void;
  onExport: () => void;
  loading: boolean;
}) {
  const current = getStepIndex(currentStep);
  const nextStep = grantSteps[Math.min(current + 1, grantSteps.length - 1)];

  return (
    <Card style={{ borderRadius: 8, marginBottom: 16 }} styles={{ body: { padding: 18 } }}>
      <Row align="middle" justify="space-between" gutter={[16, 16]}>
        <Col flex="auto">
          <Space direction="vertical" size={6}>
            <Space wrap>
              <Title level={4} style={{ margin: 0 }}>{project.title}</Title>
              <Tag color="blue">API 数据</Tag>
              <Tag color="green">五页流程</Tag>
            </Space>
            <Space wrap>
              <Tag>{project.input.fundType}</Tag>
              <Tag>{project.input.researchAreaPath.join(' / ')}</Tag>
              <Text type="secondary">保存于 {project.updatedAt}</Text>
            </Space>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button onClick={onBackList}>返回列表</Button>
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              loading={loading && currentStep === 'proposal'}
              disabled={project.id <= 0 && currentStep !== 'proposal'}
              onClick={() => currentStep === 'proposal' ? onExport() : onStepChange(nextStep.key)}
            >
              {project.id <= 0 && currentStep !== 'proposal' ? '先填写并开始选题' : currentStep === 'proposal' ? '导出 Word' : `进入${grantSteps[Math.min(current + 1, grantSteps.length - 1)]?.title}`}
            </Button>
          </Space>
        </Col>
      </Row>

      <Divider style={{ margin: '18px 0' }} />

      <Steps
        current={current}
        responsive
        items={grantSteps.map(step => ({
          title: step.title,
          description: step.description,
          onClick: () => onStepChange(step.key),
        }))}
      />
    </Card>
  );
}

function SidePanel({ project, currentStep }: { project: GrantProject; currentStep: GrantStepKey }) {
  const current = getStepIndex(currentStep);
  const selectedTopic = project.topics.find(topic => topic.selected);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card title="当前项目状态" style={{ borderRadius: 8 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="当前页面">{grantSteps[current]?.title}</Descriptions.Item>
          <Descriptions.Item label="完成度">{current + 1} / 5</Descriptions.Item>
          <Descriptions.Item label="候选题">{project.topics.length} 个</Descriptions.Item>
          <Descriptions.Item label="文献证据">{project.references.length} 条</Descriptions.Item>
          <Descriptions.Item label="状态">{project.status}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="已选题目" style={{ borderRadius: 8 }}>
        <Paragraph style={{ marginBottom: 8 }} strong>{selectedTopic?.title}</Paragraph>
        <Text type="secondary">{selectedTopic?.description}</Text>
      </Card>
    </Space>
  );
}

function InputPage({
  project,
  configOptions,
  configLoading,
  onConfigContextChange,
  onNext,
  loading,
}: {
  project: GrantProject;
  configOptions: GrantConfigOptions;
  configLoading: boolean;
  onConfigContextChange: (context: { researchAreaPath?: string[]; diseasePath?: string[] }) => void;
  onNext: (input: GrantInputState) => void;
  loading: boolean;
}) {
  const [form] = Form.useForm<GrantInputState>();
  const watchedResearchAreaPath = Form.useWatch('researchAreaPath', form);
  const watchedDiseasePath = Form.useWatch('diseasePath', form);
  const formValues = {
    fundType: project.input.fundType,
    researchAreaPath: project.input.researchAreaPath,
    subject: project.input.subject,
    diseasePath: project.input.diseasePath,
    phenotype: project.input.phenotype,
    variableType: project.input.variableType,
    variableName: project.input.variableName,
  };

  useEffect(() => {
    form.setFieldsValue(formValues);
  }, [form, project.id, project.updatedAt]);

  useEffect(() => {
    onConfigContextChange({
      researchAreaPath: watchedResearchAreaPath || [],
      diseasePath: watchedDiseasePath || [],
    });
  }, [onConfigContextChange, JSON.stringify(watchedDiseasePath || []), JSON.stringify(watchedResearchAreaPath || [])]);

  const handleValuesChange = (changedValues: Partial<GrantInputState>, _allValues: GrantInputState) => {
    if (changedValues.researchAreaPath) {
      form.setFieldsValue({ diseasePath: [], phenotype: '', variableType: '' });
      return;
    }
    if (changedValues.diseasePath) {
      form.setFieldsValue({ phenotype: '', variableType: '' });
    }
  };

  return (
    <SectionCard
      title="第 1 页：输入选题信息"
      extra={<Tag color="blue">真实表单提交</Tag>}
    >
      <Alert
        type="info"
        showIcon
        message="高级选项不是必填，但会显著影响后续关键词和候选选题的聚焦度。"
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical" initialValues={formValues} onFinish={onNext} onValuesChange={handleValuesChange}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="课题类型" name="fundType" rules={[{ required: true }]}>
              <Select
                loading={configLoading}
                showSearch
                optionFilterProp="label"
                options={configOptions.fundTypes}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="研究领域 / 研究方向" name="researchAreaPath" rules={[{ required: true }]}>
              <Cascader
                options={configOptions.researchAreas}
                showSearch
                changeOnSelect
              />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="申请书主题" name="subject">
              <TextArea rows={3} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="疾病类型 / 名称" name="diseasePath">
              <Cascader
                options={configOptions.diseases}
                showSearch
                changeOnSelect
                disabled={!watchedResearchAreaPath?.length}
                placeholder={watchedResearchAreaPath?.length ? undefined : '请先选择医学研究领域'}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="表型 / 科学问题" name="phenotype">
              <Select
                allowClear
                disabled={!watchedDiseasePath?.length}
                loading={configLoading}
                showSearch
                optionFilterProp="label"
                options={configOptions.phenotypes}
                placeholder={watchedDiseasePath?.length ? undefined : '请先选择疾病'}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="主变量类型" name="variableType">
              <Select
                allowClear
                disabled={!watchedDiseasePath?.length}
                loading={configLoading}
                showSearch
                optionFilterProp="label"
                options={configOptions.variableTypes}
                placeholder={watchedDiseasePath?.length ? undefined : '请先选择疾病'}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="主变量名称" name="variableName">
              <Input
                disabled={!watchedDiseasePath?.length}
                placeholder={watchedDiseasePath?.length ? undefined : '请先选择疾病'}
              />
            </Form.Item>
          </Col>
        </Row>
        <Space>
          <Button type="primary" icon={<ArrowRightOutlined />} loading={loading} htmlType="submit">保存并开始选题</Button>
        </Space>
      </Form>
    </SectionCard>
  );
}

function KeywordsPage({ project, onPrev, onGenerateKeywords, onSearchReferences, onNext, loading }: { project: GrantProject; onPrev: () => void; onGenerateKeywords: () => void; onSearchReferences: () => void; onNext: () => void; loading: boolean }) {
  const selectedShould = project.keywords.should.filter(keyword => keyword.selected);
  const expression = `(${project.keywords.must.map(keyword => keyword.text).join(' AND ') || '等待生成'}) AND (${selectedShould.map(keyword => keyword.text).join(' OR ') || '等待生成'})`;
  const hasKeywords = project.keywords.must.length > 0 || project.keywords.should.length > 0 || project.keywords.groups.length > 0;
  const hasReferences = project.references.length > 0;

  return (
    <SectionCard
      title="第 2 页：选题关键词"
      extra={<Tag color="green">已生成关键词边界</Tag>}
    >
      <Row gutter={[16, 16]}>
        {!hasKeywords && (
          <Col span={24}>
            <Alert
              type="warning"
              showIcon
              message="当前项目还没有 AI 关键词。请先点击 AI 生成关键词；如果 AI 服务鉴权失败，这里不会写入任何生成内容。"
            />
          </Col>
        )}
        <Col span={24}>
          <Text strong>必须包含 AND</Text>
          <div style={{ marginTop: 8 }}>
            {project.keywords.must.map(keyword => <Tag color="blue" key={keyword.id}>{keyword.text}</Tag>)}
          </div>
        </Col>
        <Col span={24}>
          <Text strong>可选扩展 OR</Text>
          <div style={{ marginTop: 8 }}>
            {project.keywords.should.map(keyword => (
              <Tag color={keyword.selected ? 'processing' : 'default'} key={keyword.id}>
                {keyword.text}
              </Tag>
            ))}
          </div>
        </Col>
        <Col span={24}>
          <Alert message="检索表达式预览" description={expression} type="info" showIcon />
        </Col>
      </Row>

      <Divider />

      <Row gutter={[12, 12]}>
        {project.keywords.groups.map(group => (
          <Col span={12} key={group.key}>
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, minHeight: 112 }}>
              <Text strong>{group.label}</Text>
              <div style={{ marginTop: 10 }}>
                {group.keywords.map(keyword => (
                  <Tag key={keyword.id} color={keyword.selected ? 'green' : 'default'}>{keyword.text}</Tag>
                ))}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <Divider />

      <SectionCard
        title="文献检索预览"
        extra={<Button size="small" loading={loading} disabled={!hasKeywords} onClick={onSearchReferences}>{hasReferences ? '重新检索文献' : '检索文献'}</Button>}
      >
        {!hasReferences && (
          <Alert
            type="info"
            showIcon
            message={hasKeywords ? '点击“检索文献”后，这里会显示真实数据库返回的文献。' : '请先生成关键词，再检索文献。'}
            style={{ marginBottom: 12 }}
          />
        )}
        <List
          dataSource={project.references}
          renderItem={item => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space wrap>
                    <Text strong>{item.title}</Text>
                    {item.year && <Tag>{item.year}</Tag>}
                    {item.database && <Tag color="blue">{item.database}</Tag>}
                  </Space>
                }
                description={
                  <Space direction="vertical" size={2}>
                    <Text type="secondary">{referenceMeta(item)}</Text>
                    <Text type="secondary">{item.evidenceNote}</Text>
                    {item.link && <Typography.Link href={item.link} target="_blank">查看来源</Typography.Link>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </SectionCard>

      <Space>
        <Button icon={<ArrowLeftOutlined />} onClick={onPrev}>上一步</Button>
        <Button loading={loading} onClick={onGenerateKeywords}>AI 生成关键词</Button>
        <Button loading={loading} disabled={!hasKeywords} onClick={onSearchReferences}>{hasReferences ? '重新检索文献' : '检索文献'}</Button>
        <Button type="primary" icon={<ArrowRightOutlined />} loading={loading} disabled={!hasKeywords || !hasReferences} onClick={onNext}>生成创新选题</Button>
      </Space>
    </SectionCard>
  );
}

function TopicsPage({ project, onPrev, onNext, onSelectTopic, loading }: { project: GrantProject; onPrev: () => void; onNext: () => void; onSelectTopic: (topicId: string) => void; loading: boolean }) {
  const columns = [
    { title: '题目', dataIndex: 'title', key: 'title', render: (value: string, record: GrantCandidateTopic) => (
      <Space direction="vertical" size={4}>
        <Space wrap>
          <Text strong>{value}</Text>
          {record.selected && <Tag color="blue">已选择</Tag>}
        </Space>
        <Text type="secondary">{record.description}</Text>
      </Space>
    ) },
    { title: '创新性', dataIndex: ['score', 'innovation'], key: 'innovation', width: 100, render: (value: number) => <Progress percent={value} size="small" strokeColor={scoreColor(value)} /> },
    { title: '可行性', dataIndex: ['score', 'feasibility'], key: 'feasibility', width: 100, render: (value: number) => <Progress percent={value} size="small" strokeColor={scoreColor(value)} /> },
    { title: '基金适配', dataIndex: ['score', 'fundFit'], key: 'fundFit', width: 100, render: (value: number) => <Progress percent={value} size="small" strokeColor={scoreColor(value)} /> },
    { title: '操作', key: 'action', width: 150, render: (_: unknown, record: GrantCandidateTopic) => (
      <Space>
        <Button size="small" type={record.selected ? 'primary' : 'default'} icon={<CheckCircleOutlined />} onClick={() => onSelectTopic(record.id)}>选择</Button>
      </Space>
    ) },
  ];

  return (
    <SectionCard
      title="第 3 页：基金选题"
      extra={<Tag color="blue">{project.topics.length} 个候选题</Tag>}
    >
      <Alert
        type="info"
        showIcon
        message="系统会先检索真实文献，再基于关键词和文献调用 AI 生成候选题；若 AI 服务不可用，本步骤会直接失败并提示原因。"
        style={{ marginBottom: 16 }}
      />
      <Table
        rowKey="id"
        columns={columns}
        dataSource={project.topics}
        pagination={false}
        expandable={{
          expandedRowRender: record => (
            <Row gutter={16}>
              <Col span={6}><Text strong>创新点：</Text><Text>{record.innovation}</Text></Col>
              <Col span={6}><Text strong>可行性：</Text><Text>{record.feasibility}</Text></Col>
              <Col span={6}><Text strong>基金匹配：</Text><Text>{record.fundFit}</Text></Col>
              <Col span={6}><Text strong>风险：</Text><Text>{record.risk}</Text></Col>
            </Row>
          ),
          defaultExpandedRowKeys: ['topic-1'],
        }}
      />
      <Divider />
      <Space>
        <Button icon={<ArrowLeftOutlined />} onClick={onPrev}>上一步</Button>
        <Button type="primary" icon={<ArrowRightOutlined />} loading={loading} onClick={onNext}>确认并生成选题报告</Button>
      </Space>
    </SectionCard>
  );
}

function ReportPage({
  project,
  versions,
  selectedVersionId,
  onSelectVersion,
  onPrev,
  onNext,
  loading,
}: {
  project: GrantProject;
  versions: GrantReportVersion[];
  selectedVersionId: number | null;
  onSelectVersion: (versionId: number | null) => void;
  onPrev: () => void;
  onNext: () => void;
  loading: boolean;
}) {
  const selectedVersion = versions.find(version => version.id === selectedVersionId);
  const displayedSections = selectedVersion?.output || project.reportSections;
  const versionLabel = selectedVersion ? `历史版本 #${selectedVersion.id}` : '当前版本';

  return (
    <SectionCard
      title="第 4 页：选题报告"
      extra={<Tag color="green">{versionLabel}</Tag>}
    >
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <div style={{ borderRight: '1px solid #f0f0f0', minHeight: 320, paddingRight: 12 }}>
            <Text strong>报告目录</Text>
            <List
              size="small"
              dataSource={displayedSections}
              renderItem={section => <List.Item>{section.title}</List.Item>}
            />
            <Divider />
            <Text strong>历史版本</Text>
            <List
              size="small"
              dataSource={versions}
              locale={{ emptyText: '暂无历史版本' }}
              renderItem={version => (
                <List.Item
                  onClick={() => onSelectVersion(version.id)}
                  style={{ cursor: 'pointer', background: selectedVersionId === version.id ? '#e6f4ff' : 'transparent', paddingLeft: 8 }}
                >
                  <Space direction="vertical" size={0}>
                    <Text strong={selectedVersionId === version.id}>版本 #{version.id}</Text>
                    <Text type="secondary">{version.created_at}</Text>
                    <Text type="secondary">{version.output.length} 个章节</Text>
                  </Space>
                </List.Item>
              )}
            />
            {selectedVersionId && (
              <Button size="small" style={{ marginTop: 8 }} onClick={() => onSelectVersion(null)}>查看当前版本</Button>
            )}
          </div>
        </Col>
        <Col span={18}>
          {displayedSections.map(section => (
            <div key={section.key} style={{ marginBottom: 20 }}>
              <Title level={5}>{section.title}</Title>
              <Paragraph>{section.markdown}</Paragraph>
            </div>
          ))}
          <Divider />
          <Title level={5}>参考文献</Title>
          <List
            size="small"
            dataSource={project.references}
            renderItem={item => <List.Item>{item.title} ({item.journal}, {item.year})</List.Item>}
          />
        </Col>
      </Row>
      <Divider />
      <Space>
        <Button icon={<ArrowLeftOutlined />} onClick={onPrev}>上一步</Button>
        <Button type="primary" icon={<ArrowRightOutlined />} loading={loading} onClick={onNext}>生成基金申请书</Button>
      </Space>
    </SectionCard>
  );
}

function ProposalStatusTag({ section }: { section: GrantProposalSection }) {
  const colorMap: Record<GrantProposalSection['status'], string> = {
    pending: 'default',
    generating: 'processing',
    ready: 'green',
    edited: 'blue',
    failed: 'red',
    needs_review: 'orange',
  };
  const labelMap: Record<GrantProposalSection['status'], string> = {
    pending: '待生成',
    generating: '生成中',
    ready: '已生成',
    edited: '已编辑',
    failed: '失败',
    needs_review: '需检查',
  };
  return <Tag color={colorMap[section.status]}>{labelMap[section.status]}</Tag>;
}

function ProposalPage({
  project,
  selectedSectionKey,
  onSelectSection,
  onPrev,
  onExport,
  loading,
}: {
  project: GrantProject;
  selectedSectionKey: string | null;
  onSelectSection: (sectionKey: string) => void;
  onPrev: () => void;
  onExport: () => void;
  loading: boolean;
}) {
  const activeSection = project.proposalSections.find(section => section.key === selectedSectionKey)
    || project.proposalSections[0]
    || { title: '申请书章节', markdown: '', status: 'pending', wordCount: 0, key: 'empty' } as GrantProposalSection;
  const isRouteSection = activeSection.title.includes('技术路线');

  return (
    <SectionCard
      title="第 5 页：申请书生成"
      extra={<Tag color="green">国自然-青年基金初稿</Tag>}
    >
      <Row gutter={[16, 16]}>
        <Col span={7}>
          <List
            bordered
            dataSource={project.proposalSections}
            renderItem={section => (
              <List.Item
                onClick={() => onSelectSection(section.key)}
                style={{ cursor: 'pointer', background: activeSection.key === section.key ? '#e6f4ff' : 'transparent' }}
              >
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Text strong={activeSection.key === section.key}>{section.title}</Text>
                    <ProposalStatusTag section={section} />
                  </Space>
                  <Text type="secondary">{section.wordCount} 字</Text>
                </Space>
              </List.Item>
            )}
          />
        </Col>
        <Col span={17}>
          {isRouteSection && (
            <Alert
              type="info"
              showIcon
              message="当前章节包含技术路线内容，正式提交前建议核对图示、步骤关系和文字说明。"
              style={{ marginBottom: 12 }}
            />
          )}
          <Title level={5}>{activeSection.title}</Title>
          <TextArea rows={12} value={activeSection.markdown} readOnly />
        </Col>
      </Row>
      <Divider />
      <Space>
        <Button icon={<ArrowLeftOutlined />} onClick={onPrev}>上一步</Button>
        <Button type="primary" icon={<FileTextOutlined />} loading={loading} onClick={onExport}>导出 Word</Button>
      </Space>
    </SectionCard>
  );
}

function ProjectListPage({
  projects,
  loading,
  onCreate,
  onOpen,
}: {
  projects: GrantProjectSummary[];
  loading: boolean;
  onCreate: () => void;
  onOpen: (project: GrantProjectSummary) => void;
}) {
  const columns = [
    {
      title: '项目题目',
      dataIndex: 'title',
      key: 'title',
      render: (value: string, record: GrantProjectSummary) => (
        <Space direction="vertical" size={2}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.research_area_path.join(' / ')}</Text>
        </Space>
      ),
    },
    { title: '基金类型', dataIndex: 'fund_type', key: 'fund_type', width: 160 },
    {
      title: '当前步骤',
      dataIndex: 'current_step',
      key: 'current_step',
      width: 140,
      render: (value: GrantStepKey) => grantSteps.find(step => step.key === value)?.title || value,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (value: string) => <Tag color={value.includes('ready') ? 'green' : 'blue'}>{value}</Tag>,
    },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 220 },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: GrantProjectSummary) => <Button type="link" onClick={() => onOpen(record)}>继续</Button>,
    },
  ];

  return (
    <div style={{ background: '#f5f7fb', margin: -24, padding: 24, minHeight: 'calc(100vh - 112px)' }}>
      <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 20 } }}>
        <Row align="middle" justify="space-between" gutter={[16, 16]} style={{ marginBottom: 18 }}>
          <Col>
            <Space direction="vertical" size={4}>
              <Title level={4} style={{ margin: 0 }}>课题申报</Title>
              <Text type="secondary">从申报条件、关键词、文献证据到选题报告和申请书初稿的完整流程。</Text>
            </Space>
          </Col>
          <Col>
            <Button type="primary" icon={<FileTextOutlined />} loading={loading} onClick={onCreate}>新建申报项目</Button>
          </Col>
        </Row>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={projects}
          loading={loading}
          pagination={false}
          locale={{ emptyText: '暂无课题申报项目，点击右上角新建' }}
        />
      </Card>
    </div>
  );
}

export default function GrantApplicationWorkbench() {
  const navigate = useNavigate();
  const location = useLocation();
  const { serviceToken } = useServiceToken();
  const currentStep = getStepFromPath(location.pathname);
  const currentIndex = getStepIndex(currentStep);
  const [project, setProject] = useState<GrantProject>(emptyGrantProject);
  const [projectSummaries, setProjectSummaries] = useState<GrantProjectSummary[]>([]);
  const [reportVersions, setReportVersions] = useState<GrantReportVersion[]>([]);
  const [selectedReportVersionId, setSelectedReportVersionId] = useState<number | null>(null);
  const [selectedProposalSectionKey, setSelectedProposalSectionKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [configOptions, setConfigOptions] = useState<GrantConfigOptions>(emptyConfigOptions);
  const [configLoading, setConfigLoading] = useState(false);
  const configContextKeyRef = useRef<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  const routeProjectId = useMemo(() => {
    const match = location.pathname.match(/\/projects\/(\d+)/);
    return match ? Number(match[1]) : null;
  }, [location.pathname]);
  const isProjectListRoute = location.pathname.replace(/\/$/, '') === '/frontend/grant';
  const isNewProjectRoute = !routeProjectId && currentStep === 'input' && !isProjectListRoute;

  const goStep = (step: GrantStepKey) => {
    if (project.id > 0) {
      navigate(`/frontend/grant/projects/${project.id}/${step}`);
      return;
    }
    navigate(`/frontend/grant/${step}`);
  };

  const backToList = () => {
    navigate('/frontend/grant');
  };

  const makeConfigContextKey = (context?: { researchAreaPath?: string[]; diseasePath?: string[] }) => JSON.stringify({
    researchAreaPath: context?.researchAreaPath || [],
    diseasePath: context?.diseasePath || [],
  });

  const refreshConfigOptions = useCallback(async (context?: { researchAreaPath?: string[]; diseasePath?: string[] }) => {
    if (!serviceToken) return;
    const contextKey = makeConfigContextKey(context);
    if (configContextKeyRef.current === contextKey) return;
    configContextKeyRef.current = contextKey;
    setConfigLoading(true);
    try {
      const options = await getGrantConfigOptions(serviceToken, context);
      setConfigOptions(options);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error?.message || '加载申报配置失败');
    } finally {
      setConfigLoading(false);
    }
  }, [serviceToken]);

  useEffect(() => {
    if (!serviceToken || bootstrapped) return;

    const loadProject = async () => {
      setLoading(true);
      setConfigLoading(true);
      try {
        const [projects, options] = await Promise.all([
          listGrantProjects(serviceToken),
          getGrantConfigOptions(serviceToken),
        ]);
        setProjectSummaries(projects);
        setConfigOptions(options);
        configContextKeyRef.current = makeConfigContextKey();

        if (routeProjectId) {
          const data = await getGrantProject(routeProjectId, serviceToken);
          setProject(data);
          setBootstrapped(true);
          return;
        }

        setBootstrapped(true);
      } catch (error: any) {
        message.error(error?.response?.data?.detail || error?.message || '加载课题申报项目失败');
        setProject(emptyGrantProject);
        setProjectSummaries([]);
        setConfigOptions(emptyConfigOptions);
        setBootstrapped(true);
      } finally {
        setLoading(false);
        setConfigLoading(false);
      }
    };

    loadProject();
  }, [bootstrapped, navigate, routeProjectId, serviceToken]);

  useEffect(() => {
    if (!serviceToken || !routeProjectId || routeProjectId === project.id) return;
    setBootstrapped(false);
  }, [project.id, routeProjectId, serviceToken]);

  const loadReportHistory = async (projectId: number) => {
    if (!serviceToken || projectId <= 0) return;
    try {
      const versions = await getGrantReportHistory(projectId, serviceToken);
      setReportVersions(versions);
      if (versions.length > 0 && selectedReportVersionId && !versions.some(version => version.id === selectedReportVersionId)) {
        setSelectedReportVersionId(null);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error?.message || '加载选题报告历史版本失败');
    }
  };

  useEffect(() => {
    if (currentStep !== 'report' || project.id <= 0) return;
    loadReportHistory(project.id);
  }, [currentStep, project.id, serviceToken]);

  useEffect(() => {
    if (currentStep !== 'proposal' || selectedProposalSectionKey || project.proposalSections.length === 0) return;
    setSelectedProposalSectionKey(project.proposalSections[0].key);
  }, [currentStep, project.proposalSections, selectedProposalSectionKey]);

  const runStepAction = async (action: () => Promise<GrantProject>, nextStep: GrantStepKey, successText: string) => {
    if (!serviceToken) {
      message.warning('请先输入服务令牌');
      return;
    }
    setLoading(true);
    try {
      const data = await action();
      setProject(data);
      message.success(successText);
      navigate(`/frontend/grant/projects/${data.id}/${nextStep}`);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!serviceToken) {
      message.warning('请先输入服务令牌');
      return;
    }
    setProject(emptyGrantProject);
    navigate('/frontend/grant/input');
  };

  const handleOpenProject = (summary: GrantProjectSummary) => {
    navigate(`/frontend/grant/projects/${summary.id}/${summary.current_step || 'input'}`);
  };

  const handleInputNext = async (input: GrantInputState) => {
    if (!serviceToken) {
      message.warning('请先输入服务令牌');
      return;
    }
    setLoading(true);
    try {
      const savedProject = project.id > 0
        ? await updateGrantProject(project.id, serviceToken, input)
        : await createGrantProject(serviceToken, input);
      const projects = await listGrantProjects(serviceToken);
      setProjectSummaries(projects);
      setProject(savedProject);
      navigate(`/frontend/grant/projects/${savedProject.id}/keywords`);

      try {
        const withKeywords = await generateGrantKeywords(savedProject.id, serviceToken);
        setProject(withKeywords);
        message.success('项目已保存，关键词已生成');
      } catch (error: any) {
        message.error(error?.response?.data?.detail || error?.message || '项目已保存，但 AI 关键词生成失败');
      }
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error?.message || '保存项目失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKeywords = async () => {
    if (!serviceToken) {
      message.warning('请先输入服务令牌');
      return;
    }
    if (project.id <= 0) {
      message.warning('请先保存申报项目');
      return;
    }
    setLoading(true);
    try {
      const data = await generateGrantKeywords(project.id, serviceToken);
      setProject(data);
      message.success('关键词已生成');
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error?.message || 'AI 关键词生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchReferences = async () => {
    if (!serviceToken) {
      message.warning('请先输入服务令牌');
      return;
    }
    if (project.id <= 0) {
      message.warning('请先保存申报项目');
      return;
    }
    if (project.keywords.must.length === 0 && project.keywords.should.length === 0) {
      message.warning('请先生成关键词');
      return;
    }
    setLoading(true);
    try {
      const data = await searchGrantReferences(project.id, serviceToken);
      setProject(data);
      message.success(data.references.length > 0 ? `已检索到 ${data.references.length} 条文献` : '未检索到文献，请调整关键词后重试');
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error?.message || '文献检索失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKeywordsNext = async () => {
    if (!serviceToken) {
      message.warning('请先输入服务令牌');
      return;
    }
    if (project.references.length === 0) {
      message.warning('请先检索文献');
      return;
    }
    setLoading(true);
    try {
      const withTopics = await generateGrantTopics(project.id, serviceToken);
      setProject(withTopics);
      message.success('候选选题已生成');
      navigate(`/frontend/grant/projects/${withTopics.id}/topics`);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error?.message || '生成创新选题失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTopicsNext = async () => {
    if (!serviceToken) {
      message.warning('请先输入服务令牌');
      return;
    }
    setLoading(true);
    try {
      const data = await generateGrantReport(project.id, serviceToken);
      setProject(data);
      setSelectedReportVersionId(null);
      await loadReportHistory(data.id);
      message.success('选题报告已生成');
      navigate(`/frontend/grant/projects/${data.id}/report`);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error?.message || '选题报告生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReportNext = async () => {
    if (!serviceToken) {
      message.warning('请先输入服务令牌');
      return;
    }
    setLoading(true);
    try {
      const data = await generateGrantProposal(project.id, serviceToken);
      setProject(data);
      setSelectedProposalSectionKey(data.proposalSections[0]?.key || null);
      message.success('基金申请书已生成');
      navigate(`/frontend/grant/projects/${data.id}/proposal`);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error?.message || '基金申请书生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTopic = async (topicId: string) => {
    if (!serviceToken) return;
    setLoading(true);
    try {
      const data = await selectGrantTopic(project.id, topicId, serviceToken);
      setProject(data);
      message.success('已切换候选题');
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error?.message || '选择候选题失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExportWord = async () => {
    if (!serviceToken) {
      message.warning('请先输入服务令牌');
      return;
    }
    setLoading(true);
    try {
      const blob = await exportGrantProposalWord(project.id, serviceToken);
      downloadBlob(blob, `课题申报申请书-${project.id}.docx`);
      message.success('Word 已导出');
    } catch (error: any) {
      message.error(error?.response?.data?.detail || error?.message || '导出 Word 失败');
    } finally {
      setLoading(false);
    }
  };

  const page = useMemo(() => {
    const prev = () => goStep(grantSteps[Math.max(currentIndex - 1, 0)].key);
    const next = () => goStep(grantSteps[Math.min(currentIndex + 1, grantSteps.length - 1)].key);

    switch (currentStep) {
      case 'input':
        return <InputPage project={project} configOptions={configOptions} configLoading={configLoading} onConfigContextChange={refreshConfigOptions} loading={loading} onNext={handleInputNext} />;
      case 'keywords':
        return <KeywordsPage project={project} loading={loading} onPrev={prev} onGenerateKeywords={handleGenerateKeywords} onSearchReferences={handleSearchReferences} onNext={handleKeywordsNext} />;
      case 'topics':
        return <TopicsPage project={project} loading={loading} onPrev={prev} onNext={handleTopicsNext} onSelectTopic={handleSelectTopic} />;
      case 'report':
        return <ReportPage project={project} versions={reportVersions} selectedVersionId={selectedReportVersionId} onSelectVersion={setSelectedReportVersionId} loading={loading} onPrev={prev} onNext={handleReportNext} />;
      case 'proposal':
        return <ProposalPage project={project} selectedSectionKey={selectedProposalSectionKey} onSelectSection={setSelectedProposalSectionKey} loading={loading} onPrev={prev} onExport={handleExportWord} />;
      default:
        return <InputPage project={project} configOptions={configOptions} configLoading={configLoading} onConfigContextChange={refreshConfigOptions} loading={loading} onNext={next} />;
    }
  }, [currentStep, currentIndex, project, configOptions, configLoading, refreshConfigOptions, loading, reportVersions, selectedReportVersionId, selectedProposalSectionKey]);

  if (!routeProjectId && !isNewProjectRoute) {
    return (
      <ProjectListPage
        projects={projectSummaries}
        loading={loading}
        onCreate={handleCreateProject}
        onOpen={handleOpenProject}
      />
    );
  }

  if (isNewProjectRoute) {
    return (
      <div style={{ background: '#f5f7fb', margin: -24, padding: 24, minHeight: 'calc(100vh - 112px)' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={18}>
            <InputPage project={project} configOptions={configOptions} configLoading={configLoading} onConfigContextChange={refreshConfigOptions} loading={loading} onNext={handleInputNext} />
          </Col>
          <Col xs={24} xl={6}>
            <SidePanel project={project} currentStep="input" />
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <div style={{ background: '#f5f7fb', margin: -24, padding: 24, minHeight: 'calc(100vh - 112px)' }}>
      <ProjectHeader project={project} currentStep={currentStep} loading={loading} onStepChange={goStep} onBackList={backToList} onExport={handleExportWord} />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={18}>
          {page}
        </Col>
        <Col xs={24} xl={6}>
          <SidePanel project={project} currentStep={currentStep} />
          <Card title="项目数据统计" style={{ borderRadius: 8, marginTop: 16 }}>
            <Space direction="vertical" size={10}>
              <Statistic title="AND 关键词" value={project.keywords.must.length} suffix="个" />
              <Statistic title="OR 关键词" value={project.keywords.should.length} suffix="个" />
              <Statistic title="申请书章节" value={project.proposalSections.length} suffix="章" />
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
