import { useState, useEffect, useCallback, type FC } from 'react';
import { Layout, message, Result, Button, Space, Typography } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import { useServiceToken } from '../../hooks/useServiceToken';
import type { ThesisProject, ThesisStep } from '../../types/thesis';
import { listProjects, getProjectSteps } from '../../services/thesisApi';
import WritingSidebar from './WritingSidebar';
import TopicGeneration from './TopicGeneration';
import OutlineGeneration from './OutlineGeneration';
import FullTextGeneration from './FullTextGeneration';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const { Sider, Content } = Layout;
const { Text } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type StepNumber = 0 | 1 | 2;

interface OutlineCache {
  content: string;
  steps: ThesisStep[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const AIWritingWorkbench: FC = () => {
  const { serviceToken } = useServiceToken();

  // Project state
  const [projects, setProjects] = useState<ThesisProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ThesisProject | null>(
    null,
  );
  const [currentStep, setCurrentStep] = useState<StepNumber>(0);

  // Step transition state
  const [stepLoading, setStepLoading] = useState(false);
  const [outlineCache, setOutlineCache] = useState<OutlineCache | null>(null);

  // -------------------------------------------------------------------------
  // Load projects
  // -------------------------------------------------------------------------
  const loadProjects = useCallback(async (): Promise<void> => {
    if (!serviceToken) return;
    setProjectsLoading(true);
    try {
      const data = await listProjects(serviceToken);
      setProjects(data);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : '加载项目列表失败';
      message.error(msg);
    } finally {
      setProjectsLoading(false);
    }
  }, [serviceToken]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // -------------------------------------------------------------------------
  // Select project -- determine current step from project steps
  // -------------------------------------------------------------------------
  const handleSelectProject = useCallback(
    async (project: ThesisProject): Promise<void> => {
      if (selectedProject?.id === project.id) return;

      setSelectedProject(project);
      setStepLoading(true);

      try {
        const steps = await getProjectSteps(project.id, serviceToken!);

        const hasOutline = steps.some((s: any) => s.step_num === 1);
        const hasFulltext = steps.some((s: any) => s.step_num === 2);

        if (hasFulltext) {
          const outlineStep = steps.find((s: any) => s.step_num === 1);
          if (outlineStep?.content) {
            setOutlineCache({ content: outlineStep.content, steps });
          }
          setCurrentStep(2);
        } else if (hasOutline) {
          setCurrentStep(1);
        } else {
          setCurrentStep(1); // New project, go to outline
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : '加载项目步骤失败';
        message.error(msg);
        setCurrentStep(0);
      } finally {
        setStepLoading(false);
      }
    },
    [selectedProject?.id, serviceToken],
  );

  // -------------------------------------------------------------------------
  // New project -- reset to topic generation
  // -------------------------------------------------------------------------
  const handleNewProject = (): void => {
    setSelectedProject(null);
    setCurrentStep(0);
    setOutlineCache(null);
  };

  // -------------------------------------------------------------------------
  // Delete project
  // -------------------------------------------------------------------------
  const handleDeleteProject = async (
    project: ThesisProject,
  ): Promise<void> => {
    setProjects((prev) => prev.filter((p) => p.id !== project.id));

    if (selectedProject?.id === project.id) {
      setSelectedProject(null);
      setCurrentStep(0);
      setOutlineCache(null);
    }

    message.success('项目已删除');
  };

  // -------------------------------------------------------------------------
  // Topic selected -- project created, move to outline
  // -------------------------------------------------------------------------
  const handleTopicSelected = async (
    project: any,
  ): Promise<void> => {
    // Backend returns {project: {id, title, ...}, outline: "...", ...}
    const actualProject = project.project || project;
    setSelectedProject(actualProject);
    await loadProjects();
    setCurrentStep(1);
    message.success('选题已确认，开始生成提纲');
  };

  // -------------------------------------------------------------------------
  // Outline confirmed -- move to fulltext
  // -------------------------------------------------------------------------
  const handleOutlineConfirmed = (
    outline: string,
    steps: ThesisStep[],
  ): void => {
    setOutlineCache({ content: outline, steps });
    setCurrentStep(2);
  };

  // -------------------------------------------------------------------------
  // Back from fulltext to outline
  // -------------------------------------------------------------------------
  const handleBackToOutline = (): void => {
    setCurrentStep(1);
  };

  // -------------------------------------------------------------------------
  // Render step content
  // -------------------------------------------------------------------------
  const renderStepContent = (): React.ReactNode => {
    if (!serviceToken) {
      return (
        <Result
          status="warning"
          title="需要服务令牌"
          subTitle="请先输入有效的服务令牌以使用 AI 写作功能"
        />
      );
    }

    switch (currentStep) {
      case 0:
        return (
          <TopicGeneration
            serviceToken={serviceToken}
            onTopicSelected={handleTopicSelected}
          />
        );

      case 1:
        if (!selectedProject) {
          return (
            <Result
              status="info"
              title="请先创建或选择一个项目"
              subTitle="在左侧列表中选择已有项目，或生成新的选题"
              extra={
                <Button type="primary" onClick={handleNewProject}>
                  生成选题
                </Button>
              }
            />
          );
        }
        return (
          <OutlineGeneration
            project={selectedProject}
            serviceToken={serviceToken}
            onOutlineConfirmed={handleOutlineConfirmed}
          />
        );

      case 2:
        if (!selectedProject || !outlineCache) {
          return (
            <Result
              status="warning"
              title="无法加载全文视图"
              subTitle="请返回提纲步骤重新确认"
              extra={
                <Button onClick={() => setCurrentStep(1)}>
                  返回提纲
                </Button>
              }
            />
          );
        }
        return (
          <FullTextGeneration
            project={selectedProject}
            outline={outlineCache.content}
            serviceToken={serviceToken}
            onBack={handleBackToOutline}
          />
        );

      default:
        return <Result status="error" title="未知步骤" />;
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const stepLabels: Record<StepNumber, string> = {
    0: '选题',
    1: '提纲编辑',
    2: '全文生成',
  };

  return (
    <Layout
      style={{
        background: 'transparent',
        height: '100%',
      }}
    >
      {/* Left sidebar -- project list */}
      <Sider
        width={300}
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          overflow: 'hidden',
        }}
      >
        <WritingSidebar
          projects={projects}
          selectedId={selectedProject?.id ?? null}
          loading={projectsLoading}
          onSelect={handleSelectProject}
          onNew={handleNewProject}
          onDelete={handleDeleteProject}
        />
      </Sider>

      {/* Right content -- current step */}
      <Content
        style={{
          padding: '0 0 0 24px',
          overflow: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <Space>
            <ExperimentOutlined
              style={{ fontSize: 20, color: '#1a1a2e' }}
            />
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              AI 写作工作台
            </span>
          </Space>

          {currentStep > 0 && (
            <Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                步骤 {currentStep} / 3：
              </Text>
              <Text strong style={{ fontSize: 13 }}>
                {stepLabels[currentStep]}
              </Text>
            </Space>
          )}
        </div>

        {/* Step content */}
        {stepLoading ? (
          <LoadingSpinner tip="加载项目数据..." />
        ) : (
          renderStepContent()
        )}
      </Content>
    </Layout>
  );
};

export default AIWritingWorkbench;
