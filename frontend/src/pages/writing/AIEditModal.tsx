// @ts-nocheck
import { type FC, useMemo, useState } from 'react';
import {
  Modal,
  Tabs,
  Typography,
  Button,
  Space,
  Tag,
  Divider,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { AIProcessResponse } from '../../types/thesis';

const { Text, Paragraph } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AIEditModalProps {
  open: boolean;
  original: string;
  result: AIProcessResponse | null;
  loading: boolean;
  acceptLabel?: string;
  rejectLabel?: string;
  onAccept: (resultText: string) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Simple inline diff renderer
// ---------------------------------------------------------------------------
function renderDiffView(
  original: string,
  modified: string,
): { additions: JSX.Element[]; deletions: JSX.Element[] } {
  const additions: JSX.Element[] = [];
  const deletions: JSX.Element[] = [];

  // Word-level diff by sentence
  const origSentences = original
    .split(/(?<=[。！？.!?])/)
    .filter(Boolean);
  const modSentences = modified
    .split(/(?<=[。！？.!?])/)
    .filter(Boolean);

  modSentences.forEach((s, i) => {
    const found = origSentences.some(
      (o) => o.trim() === s.trim(),
    );
    if (!found) {
      additions.push(
        <span
          key={`add-${i}`}
          style={{
            backgroundColor: '#e6ffed',
            padding: '2px 0',
            display: 'inline',
          }}
        >
          {s}
        </span>,
      );
    } else {
      additions.push(<span key={`keep-${i}`}>{s}</span>);
    }
  });

  origSentences.forEach((s, i) => {
    const found = modSentences.some(
      (m) => m.trim() === s.trim(),
    );
    if (!found) {
      deletions.push(
        <span
          key={`del-${i}`}
          style={{
            backgroundColor: '#ffeef0',
            textDecoration: 'line-through',
            padding: '2px 0',
            display: 'inline',
          }}
        >
          {s}
        </span>,
      );
    } else {
      deletions.push(<span key={`keep-${i}`}>{s}</span>);
    }
  });

  return { additions, deletions };
}

// ---------------------------------------------------------------------------
// Mode display names
// ---------------------------------------------------------------------------
const MODE_LABELS: Record<string, string> = {
  polish: '学术润色',
  translate: '双语翻译',
  grammar: '语法检查',
  proofread: '终极校对',
  style_change: '文风调整',
  expand: '内容扩写',
  shorten: '缩写精简',
  rewrite: '改写重述',
  reduce_similarity: '论文降重',
  abstract: '生成摘要',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const AIEditModal: FC<AIEditModalProps> = ({
  open,
  original,
  result,
  loading,
  acceptLabel = '接受修改',
  rejectLabel = '拒绝',
  onAccept,
  onClose,
}) => {
  const [diffViewMode, setDiffViewMode] = useState<'side' | 'unified'>('side');

  const { additions, deletions } = useMemo(() => {
    if (!result?.result) return { additions: [], deletions: [] };
    return renderDiffView(original, result.result);
  }, [original, result]);

  const modeLabel = result ? MODE_LABELS[result.mode] ?? result.mode : '';
  const tokenUsage = result?.token_usage;
  const hasChanges =
    additions.length > 0 &&
    JSON.stringify(additions.map(String)) !==
      JSON.stringify(deletions.map(String));

  return (
    <Modal
      title={
        <Space>
          <SwapOutlined />
          <span>AI 修改预览 {modeLabel && `— ${modeLabel}`}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width="90%"
      style={{ top: 24 }}
      footer={
        <Space>
          <Button onClick={onClose} icon={<CloseOutlined />}>
            {rejectLabel}
          </Button>
          <Button
            type="primary"
            loading={loading}
            onClick={() => {
              if (result?.result) {
                onAccept(result.result);
              }
            }}
            icon={<CheckOutlined />}
            disabled={!result?.result}
          >
            {acceptLabel}
          </Button>
        </Space>
      }
      destroyOnClose
      centered
    >
      {/* Mode badge */}
      {modeLabel && (
        <div style={{ marginBottom: 12 }}>
          <Tag color="blue">{modeLabel}</Tag>
          {tokenUsage && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Token 用量：{tokenUsage.total_tokens}
            </Text>
          )}
        </div>
      )}

      {/* Diff view */}
      <div style={{ marginBottom: 16 }}>
        <Tabs
          activeKey={diffViewMode}
          onChange={(k) => setDiffViewMode(k as 'side' | 'unified')}
          size="small"
          items={[
            { key: 'side', label: '左右对比' },
            { key: 'unified', label: '统一视图' },
          ]}
        />
      </div>

      {diffViewMode === 'side' ? (
        <div style={{ display: 'flex', gap: 16 }}>
          {/* Original */}
          <div
            style={{
              flex: 1,
              border: '1px solid #d9d9d9',
              borderRadius: 8,
              padding: 16,
              maxHeight: '60vh',
              overflowY: 'auto',
              backgroundColor: '#fafafa',
            }}
          >
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              原文
            </Text>
            <Paragraph
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.8,
                marginBottom: 0,
              }}
            >
              {deletions.length > 0 ? deletions : original}
            </Paragraph>
          </div>

          {/* Modified */}
          <div
            style={{
              flex: 1,
              border: '1px solid #d9d9d9',
              borderRadius: 8,
              padding: 16,
              maxHeight: '60vh',
              overflowY: 'auto',
              backgroundColor: '#f6ffed',
            }}
          >
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              AI 修改后
            </Text>
            <Paragraph
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.8,
                marginBottom: 0,
              }}
            >
              {additions.length > 0 ? additions : result?.result ?? ''}
            </Paragraph>
          </div>
        </div>
      ) : (
        <div
          style={{
            border: '1px solid #d9d9d9',
            borderRadius: 8,
            padding: 16,
            maxHeight: '60vh',
            overflowY: 'auto',
          }}
        >
          <Text strong style={{ display: 'block', marginBottom: 12 }}>
            修改内容（高亮为修改部分）
          </Text>
          <div style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {additions.length > 0 ? additions : result?.result ?? '无修改内容'}
          </div>
        </div>
      )}

      {/* Changes summary */}
      {!hasChanges && result?.result && (
        <Divider />
      )}
    </Modal>
  );
};

export default AIEditModal;
