// @ts-nocheck
import { useState, type FC, type MouseEvent } from 'react';
import {
  Button,
  List,
  Typography,
  Tag,
  Space,
  Popconfirm,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { ThesisProject } from '../../types/thesis';
import { DISCIPLINES } from '../../config/constants';

const { Text, Title } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface WritingSidebarProps {
  projects: ThesisProject[];
  selectedId: number | null;
  loading: boolean;
  onSelect: (project: ThesisProject) => void;
  onNew: () => void;
  onDelete: (project: ThesisProject) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getDisciplineLabel(value: string): string {
  return (
    DISCIPLINES.find((d) => d.value === value)?.label ?? value
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusColor(status: string): string {
  switch (status) {
    case 'draft':
      return 'default';
    case 'outline_generated':
      return 'processing';
    case 'fulltext_generated':
      return 'success';
    case 'completed':
      return 'green';
    default:
      return 'default';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return '草稿';
    case 'outline_generated':
      return '已有提纲';
    case 'fulltext_generated':
      return '已有全文';
    case 'completed':
      return '已完成';
    default:
      return status;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const WritingSidebar: FC<WritingSidebarProps> = ({
  projects,
  selectedId,
  loading,
  onSelect,
  onNew,
  onDelete,
}) => {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = (project: ThesisProject): void => {
    setDeletingId(project.id);
    onDelete(project);
    setDeletingId(null);
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* New Project Button */}
      <div style={{ padding: '12px 8px' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          onClick={onNew}
        >
          新建项目
        </Button>
      </div>

      {/* Project List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 8px',
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Text type="secondary">加载中...</Text>
          </div>
        ) : projects.length === 0 ? (
          <Empty
            description="暂无项目"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 40 }}
          >
            <Text type="secondary">点击上方按钮创建新项目</Text>
          </Empty>
        ) : (
          <List
            dataSource={projects}
            renderItem={(project) => {
              const isSelected = project.id === selectedId;
              const isDeleting = project.id === deletingId;

              return (
                <div
                  key={project.id}
                  onClick={() => onSelect(project)}
                  style={{
                    padding: '12px',
                    marginBottom: 8,
                    borderRadius: 8,
                    border: `1.5px solid ${isSelected ? '#1a1a2e' : '#f0f0f0'}`,
                    backgroundColor: isSelected ? '#fafafa' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                  onMouseEnter={(e: MouseEvent<HTMLDivElement>) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLDivElement).style.borderColor =
                        '#d9d9d9';
                      (e.currentTarget as HTMLDivElement).style.boxShadow =
                        '0 1px 4px rgba(0,0,0,0.06)';
                    }
                  }}
                  onMouseLeave={(e: MouseEvent<HTMLDivElement>) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLDivElement).style.borderColor =
                        '#f0f0f0';
                      (e.currentTarget as HTMLDivElement).style.boxShadow =
                        'none';
                    }
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    {/* Title */}
                    <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                      <Text
                        strong
                        style={{
                          fontSize: 13,
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: isSelected ? '#1a1a2e' : 'inherit',
                        }}
                      >
                        <FileTextOutlined
                          style={{ marginRight: 6, fontSize: 12 }}
                        />
                        {project.title ?? '未命名项目'}
                      </Text>
                    </div>

                    {/* Delete button */}
                    <Popconfirm
                      title="确定删除此项目？"
                      description="删除后不可恢复"
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        handleDelete(project);
                      }}
                      onCancel={(e) => e?.stopPropagation()}
                      okText="删除"
                      cancelText="取消"
                      placement="left"
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        loading={isDeleting}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          flexShrink: 0,
                          opacity: 0.5,
                        }}
                      />
                    </Popconfirm>
                  </div>

                  {/* Meta info */}
                  <div style={{ marginTop: 8 }}>
                    <Space size={4} wrap>
                      <Tag
                        color="blue"
                        style={{ fontSize: 11, lineHeight: '18px' }}
                      >
                        {getDisciplineLabel(project.discipline)}
                      </Tag>
                      {project.status && (
                        <Tag
                          color={statusColor(project.status)}
                          style={{ fontSize: 11, lineHeight: '18px' }}
                        >
                          {statusLabel(project.status)}
                        </Tag>
                      )}
                    </Space>
                  </div>

                  {/* Date */}
                  <div style={{ marginTop: 6 }}>
                    <Text
                      type="secondary"
                      style={{ fontSize: 11 }}
                    >
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      {formatDate(project.updated_at)}
                    </Text>
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>
    </div>
  );
};

export default WritingSidebar;
