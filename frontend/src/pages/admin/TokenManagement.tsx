import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Card,
  Space,
  Input,
  message,
  Tag,
  Modal,
  Form,
  InputNumber,
  Switch,
  DatePicker,
  Tooltip,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  DeleteOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Key } from 'antd/es/table/interface';
import dayjs from 'dayjs';

import {
  listTokens,
  createToken,
  createTokensBatch,
  deleteToken,
  deleteTokensBatch,
  updateToken,
} from '../../services/adminApi';
import type {
  TokenRecord,
  CreateTokenRequest,
  UpdateTokenRequest,
} from '../../types/admin';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mask a token to show only the first 8 characters. */
function maskToken(token: string): string {
  if (token.length <= 8) return token;
  return token.substring(0, 8) + '********';
}

// ---------------------------------------------------------------------------
// TokenManagement — 令牌管理 CRUD
// ---------------------------------------------------------------------------
export default function TokenManagement() {
  // ---------- data ----------
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  // ---------- generate ----------
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateForm] = Form.useForm();

  // ---------- result (after create) ----------
  const [resultOpen, setResultOpen] = useState(false);
  const [createdTokens, setCreatedTokens] = useState<TokenRecord[]>([]);

  // ---------- edit ----------
  const [editOpen, setEditOpen] = useState(false);
  const [editingToken, setEditingToken] = useState<TokenRecord | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm] = Form.useForm();

  // ---------- delete ----------
  const [deleteTarget, setDeleteTarget] = useState<TokenRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);

  // ---------- fetch ----------
  const fetchTokens = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTokens(search.trim() || undefined);
      setTokens(data);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '加载令牌列表失败');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // ---------- copy ----------
  const handleCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      message.success('已复制到剪贴板');
    } catch {
      message.error('复制失败');
    }
  };

  // ---------- generate ----------
  const openGenerate = () => {
    generateForm.resetFields();
    generateForm.setFieldsValue({ count: 1 });
    setGenerateOpen(true);
  };

  const handleGenerate = async () => {
    try {
      const values = await generateForm.validateFields();
      setGenerateLoading(true);

      const basePayload: CreateTokenRequest = {};
      if (values.ai_quota != null) basePayload.ai_quota = values.ai_quota;
      if (values.permissions) basePayload.permissions = values.permissions;
      if (values.expires_days != null) basePayload.expires_days = values.expires_days;

      const count: number = values.count ?? 1;
      let result: TokenRecord[];

      if (count > 1) {
        result = await createTokensBatch({ ...basePayload, count });
      } else {
        const single = await createToken(basePayload);
        result = [single];
      }

      message.success(`成功生成 ${result.length} 个令牌`);
      setGenerateOpen(false);
      setCreatedTokens(result);
      setResultOpen(true);
      await fetchTokens();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || '令牌生成失败');
    } finally {
      setGenerateLoading(false);
    }
  };

  // ---------- edit ----------
  const openEdit = (record: TokenRecord) => {
    setEditingToken(record);
    editForm.setFieldsValue({
      ai_quota: record.ai_quota,
      is_active: record.is_active,
      permissions: record.permissions,
      expires_at: record.expires_at ? dayjs(record.expires_at) : null,
    });
    setEditOpen(true);
  };

  const handleEditOk = async () => {
    if (!editingToken) return;
    try {
      const values = await editForm.validateFields();
      const payload: UpdateTokenRequest = {};
      if (values.ai_quota != null) payload.ai_quota = values.ai_quota;
      if (values.is_active !== undefined) payload.is_active = values.is_active;
      if (values.permissions !== undefined) payload.permissions = values.permissions;
      if (values.expires_at) {
        payload.expires_at = (values.expires_at as dayjs.Dayjs).toISOString();
      }

      setEditLoading(true);
      await updateToken(editingToken.id, payload);
      message.success('令牌更新成功');
      setEditOpen(false);
      setEditingToken(null);
      await fetchTokens();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || '更新失败');
    } finally {
      setEditLoading(false);
    }
  };

  // ---------- delete ----------
  const handleSingleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteToken(deleteTarget.id);
      message.success('令牌已删除');
      setDeleteTarget(null);
      await fetchTokens();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '删除失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    setBatchDeleteLoading(true);
    try {
      await deleteTokensBatch(selectedRowKeys as number[]);
      message.success(`已删除 ${selectedRowKeys.length} 个令牌`);
      setBatchDeleteOpen(false);
      setSelectedRowKeys([]);
      await fetchTokens();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '批量删除失败');
    } finally {
      setBatchDeleteLoading(false);
    }
  };

  // ---------- search ----------
  const handleSearch = (value: string) => {
    setSearch(value);
  };

  // ---------- table columns ----------
  const columns: ColumnsType<TokenRecord> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    {
      title: '令牌',
      dataIndex: 'token',
      key: 'token',
      width: 180,
      render: (v: string) => (
        <Space size={4}>
          <Tooltip title={v}>
            <Text code>{maskToken(v)}</Text>
          </Tooltip>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => handleCopy(v)}
          />
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 170,
      render: (v: string | null) =>
        v ? new Date(v).toLocaleString('zh-CN') : <Tag color="blue">永不过期</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (v: boolean) =>
        v ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>,
    },
    {
      title: '配额',
      dataIndex: 'ai_quota',
      key: 'ai_quota',
      width: 100,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '已用',
      dataIndex: 'used_quota',
      key: 'used_quota',
      width: 100,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: TokenRecord) => (
        <Space>
          <Tooltip title="复制令牌">
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopy(record.token)}
            >
              复制
            </Button>
          </Tooltip>
          <Button type="link" size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => setDeleteTarget(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // ---------- row selection ----------
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: Key[]) => setSelectedRowKeys(keys),
  };

  // ---------- render ----------
  return (
    <Card
      title="令牌管理"
      extra={
        <Space wrap>
          <Input.Search
            placeholder="搜索令牌"
            allowClear
            onSearch={handleSearch}
            style={{ width: 220 }}
            prefix={<SearchOutlined />}
          />

          <Button type="primary" icon={<PlusOutlined />} onClick={openGenerate}>
            生成令牌
          </Button>

          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={() => setBatchDeleteOpen(true)}
          >
            批量删除
            {selectedRowKeys.length > 0 && ` (${selectedRowKeys.length})`}
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        rowSelection={rowSelection}
        columns={columns}
        dataSource={tokens}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        scroll={{ x: 1000 }}
      />

      {/* ---- Generate Modal ---- */}
      <Modal
        title="生成令牌"
        open={generateOpen}
        onOk={handleGenerate}
        onCancel={() => setGenerateOpen(false)}
        confirmLoading={generateLoading}
        destroyOnClose
        forceRender
      >
        <Form form={generateForm} layout="vertical">
          <Form.Item name="count" label="生成数量">
            <InputNumber
              min={1}
              max={100}
              style={{ width: '100%' }}
              placeholder="1 表示单个生成"
            />
          </Form.Item>

          <Form.Item name="ai_quota" label="AI 配额">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="配额数量" />
          </Form.Item>

          <Form.Item name="permissions" label="权限">
            <Input placeholder="权限字符串（可选）" />
          </Form.Item>

          <Form.Item name="expires_days" label="有效天数">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="留空表示永不过期" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---- Created Tokens Result Modal ---- */}
      <Modal
        title="生成的令牌"
        open={resultOpen}
        onCancel={() => {
          setResultOpen(false);
          setCreatedTokens([]);
        }}
        footer={null}
        width={640}
        destroyOnClose
      >
        {createdTokens.length > 0 && (
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            <p style={{ color: '#faad14', marginBottom: 12 }}>
              请立即复制并保存令牌，关闭后无法再次查看完整令牌。
            </p>
            {createdTokens.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  marginBottom: 8,
                  background: '#f5f5f5',
                  borderRadius: 6,
                }}
              >
                <Text
                  copyable
                  code
                  style={{ wordBreak: 'break-all', flex: 1, marginRight: 8 }}
                >
                  {t.token}
                </Text>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(t.token)}
                >
                  复制
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ---- Edit Modal ---- */}
      <Modal
        title="编辑令牌"
        open={editOpen}
        onOk={handleEditOk}
        onCancel={() => {
          setEditOpen(false);
          setEditingToken(null);
        }}
        confirmLoading={editLoading}
        destroyOnClose
        forceRender
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="ai_quota" label="AI 配额">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="permissions" label="权限">
            <Input placeholder="权限字符串" />
          </Form.Item>

          <Form.Item name="expires_at" label="过期时间">
            <DatePicker
              showTime
              style={{ width: '100%' }}
              placeholder="留空表示永不过期"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---- Single Delete Confirmation ---- */}
      <Modal
        title="确认删除"
        open={!!deleteTarget}
        onOk={handleSingleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLoading={deleteLoading}
        okText="删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <p>
          确定删除令牌「{deleteTarget?.token ? maskToken(deleteTarget.token) : ''}」吗？此操作不可撤销。
        </p>
      </Modal>

      {/* ---- Batch Delete Confirmation ---- */}
      <Modal
        title="确认批量删除"
        open={batchDeleteOpen}
        onOk={handleBatchDelete}
        onCancel={() => setBatchDeleteOpen(false)}
        confirmLoading={batchDeleteLoading}
        okText="删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <p>
          确定删除选中的 {selectedRowKeys.length} 个令牌吗？此操作不可撤销。
        </p>
      </Modal>
    </Card>
  );
}
