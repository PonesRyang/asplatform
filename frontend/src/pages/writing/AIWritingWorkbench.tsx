import { useState, useEffect, useCallback, type FC } from 'react';
import { Result, Button, Space, Typography, message } from 'antd';
import { ArrowLeftOutlined, ExperimentOutlined } from '@ant-design/icons';
import { useServiceToken } from '../../hooks/useServiceToken';
import type { ThesisProject, ThesisStep } from '../../types/thesis';
import { getProjectSteps } from '../../services/thesisApi';
import TopicGeneration from './TopicGeneration';
import OutlineGeneration from './OutlineGeneration';
import FullTextGeneration from './FullTextGeneration';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const { Text } = Typography;

type StepNumber = 0 | 1 | 2;

interface OutlineCache { content: string; steps: ThesisStep[]; }

interface Props {
  projects: ThesisProject[];
  selectedProjectId: number | null;
  onProjectSelect: (p: ThesisProject) => void;
  onProjectNew: () => void;
  onProjectsRefresh: () => void;
  onProjectDelete: (id: number) => void;
}

const stepLabels: Record<StepNumber, string> = { 0: '选题', 1: '提纲编辑', 2: '全文生成' };

const AIWritingWorkbench: FC<Props> = ({ projects, selectedProjectId, onProjectSelect, onProjectNew, onProjectsRefresh, onProjectDelete }) => {
  const { serviceToken } = useServiceToken();

  const [currentStep, setCurrentStep] = useState<StepNumber>(0);
  const [stepLoading, setStepLoading] = useState(false);
  const [outlineCache, setOutlineCache] = useState<OutlineCache | null>(null);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  // Load project steps to determine current step
  const loadAndEnterProject = useCallback(async (project: ThesisProject) => {
    setStepLoading(true);
    try {
      const steps = await getProjectSteps(project.id, serviceToken!);
      const hasOutline = steps.some((s: any) => s.step_num === 1);
      const hasFulltext = steps.some((s: any) => s.step_num === 2);

      if (hasFulltext) {
        const outlineStep = steps.find((s: any) => s.step_num === 1);
        if (outlineStep?.content) setOutlineCache({ content: outlineStep.content, steps });
        setCurrentStep(2);
      } else if (hasOutline) {
        setCurrentStep(1);
      } else {
        setCurrentStep(1);
      }
    } catch (err: any) {
      message.error(err?.message || '加载项目步骤失败');
      setCurrentStep(0);
    } finally {
      setStepLoading(false);
    }
  }, [serviceToken]);

  // Auto-load project when selectedProjectId changes (sidebar click)
  useEffect(() => {
    if (selectedProjectId && selectedProject) {
      loadAndEnterProject(selectedProject);
    }
  }, [selectedProjectId]); // eslint-disable-line

  // When user clicks a project in the sidebar
  const handleSelectProject = useCallback(async (project: ThesisProject) => {
    onProjectSelect(project);
    await loadAndEnterProject(project);
  }, [onProjectSelect, loadAndEnterProject]);

  // Topic selected → project created
  const handleTopicSelected = async (project: any) => {
    const actualProject = project.project || project;
    onProjectsRefresh(); // reload project list from parent
    onProjectSelect(actualProject);
    setCurrentStep(1);
    message.success('论文项目已创建，可先补充参考文献后生成提纲');
  };

  const handleOutlineConfirmed = (outline: string, steps: ThesisStep[]) => {
    setOutlineCache({ content: outline, steps });
    setCurrentStep(2);
  };

  const handleBackHome = () => {
    setCurrentStep(0);
    setOutlineCache(null);
    onProjectNew();
  };

  const renderStepContent = () => {
    if (!serviceToken) {
      return <Result status="warning" title="需要服务令牌" subTitle="请先输入有效的服务令牌" />;
    }

    switch (currentStep) {
      case 0:
        return <TopicGeneration serviceToken={serviceToken} onTopicSelected={handleTopicSelected} />;

      case 1:
        if (!selectedProject) {
          return (
            <Result status="info" title="请先创建或选择一个项目"
              subTitle="在左侧项目列表中点击已有项目，或点击「新建」生成选题"
              extra={<Button type="primary" onClick={onProjectNew}>生成选题</Button>} />
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
            <Result status="warning" title="无法加载全文视图"
              subTitle="请返回提纲步骤重新确认"
              extra={<Button onClick={() => setCurrentStep(1)}>返回提纲</Button>} />
          );
        }
        return (
          <FullTextGeneration
            project={selectedProject}
            outline={outlineCache.content}
            serviceToken={serviceToken}
            onBack={() => setCurrentStep(1)}
          />
        );

      default:
        return <Result status="error" title="未知步骤" />;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <Space>
          <ExperimentOutlined style={{ fontSize: 20, color: '#1a1a2e' }} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>AI 写作工作台</span>
        </Space>
        {currentStep > 0 && (
          <Space>
            <Button size="small" icon={<ArrowLeftOutlined />} onClick={handleBackHome}>
              返回首页
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>步骤 {currentStep} / 3：</Text>
            <Text strong style={{ fontSize: 13 }}>{stepLabels[currentStep]}</Text>
          </Space>
        )}
      </div>
      {stepLoading ? <LoadingSpinner tip="加载项目数据..." /> : renderStepContent()}
    </div>
  );
};

export default AIWritingWorkbench;
