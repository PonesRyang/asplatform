// @ts-nocheck
import { useState, type FC } from 'react';
import {
  Button,
  Popover,
  Select,
  InputNumber,
  Typography,
  Divider,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  FormOutlined,
  TranslationOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  ExpandOutlined,
  CompressOutlined,
  EditOutlined,
  PercentageOutlined,
  FileTextOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface AIOperationOptions {
  mode: string;
  instructions?: string;
  intensity?: string;
  style?: string;
  direction?: string;
  level?: string;
  target_multiplier?: number;
  word_count?: number;
  format?: string;
}

interface AIOperationsToolbarProps {
  disabled?: boolean;
  onOperation: (mode: string, options: AIOperationOptions) => void;
}

// ---------------------------------------------------------------------------
// Operation definitions
// ---------------------------------------------------------------------------
interface OperationDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  hasOptions: boolean;
  options?: {
    intensity?: string[];
    style?: string[];
    direction?: string[];
    level?: string[];
    format?: string[];
  };
}

const OPERATIONS: OperationDef[] = [
  {
    key: 'polish',
    label: '学术润色',
    icon: <FormOutlined />,
    hasOptions: true,
    options: {
      intensity: ['保守', '标准', '深度'],
      style: ['通用学术', '国际期刊', '学位论文'],
    },
  },
  {
    key: 'translate',
    label: '双语翻译',
    icon: <TranslationOutlined />,
    hasOptions: true,
    options: {
      direction: ['自动检测', '中译英', '英译中'],
    },
  },
  {
    key: 'grammar',
    label: '语法检查',
    icon: <CheckCircleOutlined />,
    hasOptions: true,
    options: {
      level: ['基础', '详细'],
    },
  },
  {
    key: 'proofread',
    label: '终极校对',
    icon: <SafetyCertificateOutlined />,
    hasOptions: false,
  },
  {
    key: 'style_change',
    label: '文风调整',
    icon: <SwapOutlined />,
    hasOptions: false,
  },
  {
    key: 'expand',
    label: '内容扩写',
    icon: <ExpandOutlined />,
    hasOptions: true,
  },
  {
    key: 'shorten',
    label: '缩写精简',
    icon: <CompressOutlined />,
    hasOptions: false,
  },
  {
    key: 'rewrite',
    label: '改写重述',
    icon: <EditOutlined />,
    hasOptions: true,
    options: {
      intensity: ['保守', '标准', '深度'],
    },
  },
  {
    key: 'reduce_similarity',
    label: '论文降重',
    icon: <PercentageOutlined />,
    hasOptions: false,
  },
  {
    key: 'abstract',
    label: '生成摘要',
    icon: <FileTextOutlined />,
    hasOptions: true,
    options: {
      format: ['结构化', '叙述性', '信息性'],
    },
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const AIOperationsToolbar: FC<AIOperationsToolbarProps> = ({
  disabled = false,
  onOperation,
}) => {
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [options, setOptions] = useState<AIOperationOptions>({});

  const handleOptionChange = (
    key: string,
    value: string | number | undefined,
  ): void => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleExecute = (mode: string): void => {
    onOperation(mode, { ...options, mode });
    setActivePopover(null);
    setOptions({});
  };

  const renderOptionsContent = (
    def: OperationDef,
  ): React.ReactNode => {
    const { key, options: defOptions } = def;

    return (
      <div style={{ minWidth: 220, padding: '8px 0' }}>
        {key === 'polish' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                润色强度
              </Text>
              <Select
                size="small"
                style={{ width: '100%' }}
                placeholder="选择强度"
                value={options.intensity}
                onChange={(v) => handleOptionChange('intensity', v)}
                options={(defOptions?.intensity ?? []).map((i) => ({
                  value: i,
                  label: i,
                }))}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                文风
              </Text>
              <Select
                size="small"
                style={{ width: '100%' }}
                placeholder="选择文风"
                value={options.style}
                onChange={(v) => handleOptionChange('style', v)}
                options={(defOptions?.style ?? []).map((s) => ({
                  value: s,
                  label: s,
                }))}
              />
            </div>
          </>
        )}

        {key === 'translate' && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              翻译方向
            </Text>
            <Select
              size="small"
              style={{ width: '100%' }}
              placeholder="选择方向"
              value={options.direction}
              onChange={(v) => handleOptionChange('direction', v)}
              options={(defOptions?.direction ?? []).map((d) => ({
                value: d,
                label: d,
              }))}
            />
          </div>
        )}

        {key === 'grammar' && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              检查级别
            </Text>
            <Select
              size="small"
              style={{ width: '100%' }}
              placeholder="选择级别"
              value={options.level}
              onChange={(v) => handleOptionChange('level', v)}
              options={(defOptions?.level ?? []).map((l) => ({
                value: l,
                label: l,
              }))}
            />
          </div>
        )}

        {key === 'expand' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                扩写倍数
              </Text>
              <InputNumber
                size="small"
                style={{ width: '100%' }}
                min={1.2}
                max={5}
                step={0.1}
                placeholder="1.5"
                value={options.target_multiplier}
                onChange={(v) =>
                  handleOptionChange(
                    'target_multiplier',
                    v ?? undefined,
                  )
                }
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                扩写方向
              </Text>
              <Select
                size="small"
                style={{ width: '100%' }}
                placeholder="选择方向"
                value={options.direction}
                onChange={(v) => handleOptionChange('direction', v)}
                options={[
                  { value: '深度', label: '深度（增加细节）' },
                  { value: '广度', label: '广度（扩充范围）' },
                  { value: '偏理论', label: '偏理论' },
                  { value: '偏应用', label: '偏应用' },
                ]}
              />
            </div>
          </>
        )}

        {key === 'rewrite' && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              改写强度
            </Text>
            <Select
              size="small"
              style={{ width: '100%' }}
              placeholder="选择强度"
              value={options.intensity}
              onChange={(v) => handleOptionChange('intensity', v)}
              options={(defOptions?.intensity ?? []).map((i) => ({
                value: i,
                label: i,
              }))}
            />
          </div>
        )}

        {key === 'abstract' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                摘要格式
              </Text>
              <Select
                size="small"
                style={{ width: '100%' }}
                placeholder="选择格式"
                value={options.format}
                onChange={(v) => handleOptionChange('format', v)}
                options={(defOptions?.format ?? []).map((f) => ({
                  value: f,
                  label: f,
                }))}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                字数限制
              </Text>
              <InputNumber
                size="small"
                style={{ width: '100%' }}
                min={100}
                max={2000}
                step={50}
                placeholder="300"
                value={options.word_count}
                onChange={(v) =>
                  handleOptionChange('word_count', v ?? undefined)
                }
              />
            </div>
          </>
        )}

        <Divider style={{ margin: '8px 0' }} />
        <Button
          type="primary"
          size="small"
          block
          onClick={() => handleExecute(key)}
        >
          执行{def.label}
        </Button>
      </div>
    );
  };

  const menuItems: MenuProps['items'] = OPERATIONS.map((op) => ({
    key: op.key,
    icon: op.icon,
    label: op.label,
  }));

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '8px 0',
        marginBottom: 16,
        borderBottom: '1px solid #f0f0f0',
        alignItems: 'center',
      }}
    >
      <Text type="secondary" style={{ fontSize: 13, marginRight: 8 }}>
        AI 操作：
      </Text>

      {OPERATIONS.map((op) =>
        op.hasOptions ? (
          <Popover
            key={op.key}
            open={activePopover === op.key}
            onOpenChange={(visible) => {
              if (visible) {
                setActivePopover(op.key);
                setOptions({ mode: op.key });
              } else {
                setActivePopover(null);
              }
            }}
            trigger="click"
            placement="bottomLeft"
            content={renderOptionsContent(op)}
            title={null}
          >
            <Button
              size="small"
              icon={op.icon}
              disabled={disabled}
            >
              {op.label}
            </Button>
          </Popover>
        ) : (
          <Button
            key={op.key}
            size="small"
            icon={op.icon}
            disabled={disabled}
            onClick={() =>
              onOperation(op.key, { mode: op.key })
            }
          >
            {op.label}
          </Button>
        ),
      )}
    </div>
  );
};

export default AIOperationsToolbar;
