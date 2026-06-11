import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import { EditOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import { listLiteratureDatabases, updateLiteratureDatabase } from '../../services/adminApi';
import type { LiteratureDatabaseConfig } from '../../types/admin';

const { Text } = Typography;

interface FormValues {
  name: string;
  description?: string;
  modules: string[];
  is_enabled: boolean;
  default_selected: boolean;
  sort_order: number;
}

const moduleOptions = [
  { label: '全部模块', value: 'all' },
  { label: '课题申报', value: 'grant' },
  { label: 'AI 写作', value: 'writing' },
  { label: '通用文献检索', value: 'literature' },
];

function moduleLabel(value: string) {
  return moduleOptions.find(item => item.value === value)?.label || value;
}

export default function LiteratureDatabaseManagement() {
  const [items, setItems] = useState<LiteratureDatabaseConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<LiteratureDatabaseConfig | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listLiteratureDatabases());
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '加载文献库配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openEdit = (item: LiteratureDatabaseConfig) => {
    setEditingItem(item);
    form.setFieldsValue({
      name: item.name,
      description: item.description || '',
      modules: (item.modules || 'all').split(',').filter(Boolean),
      is_enabled: item.is_enabled,
      default_selected: item.default_selected,
      sort_order: item.sort_order,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingItem) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      await updateLiteratureDatabase(editingItem.id, {
        name: values.name,
        description: values.description || null,
        modules: values.modules.join(','),
        is_enabled: values.is_enabled,
        default_selected: values.default_selected,
        sort_order: values.sort_order,
      });
      message.success('文献库配置已更新');
      setModalOpen(false);
      await fetchItems();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<LiteratureDatabaseConfig> = [
    {
      title: '文献库',
      dataIndex: 'name',
      render: (value: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.key}</Text>
        </Space>
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      render: value => value || <Text type="secondary">未填写</Text>,
    },
    {
      title: '适用模块',
      dataIndex: 'modules',
      width: 240,
      render: value => (
        <Space wrap size={4}>
          {(value || 'all').split(',').filter(Boolean).map((item: string) => (
            <Tag key={item} color={item === 'all' ? 'blue' : 'default'}>{moduleLabel(item)}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '默认',
      dataIndex: 'default_selected',
      width: 90,
      render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? '默认选中' : '手动选择'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'is_enabled',
      width: 90,
      render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? '启用' : '停用'}</Tag>,
    },
    { title: '排序', dataIndex: 'sort_order', width: 80 },
    {
      title: '操作',
      key: 'action',
      width: 90,
      render: (_, record) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
      ),
    },
  ];

  return (
    <Card
      title="文献库配置"
      extra={<Button icon={<ReloadOutlined />} onClick={fetchItems}>刷新</Button>}
      style={{ borderRadius: 8 }}
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingItem ? `编辑文献库：${editingItem.name}` : '编辑文献库'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="适用模块" name="modules" rules={[{ required: true, message: '请选择适用模块' }]}>
            <Select mode="multiple" options={moduleOptions} />
          </Form.Item>
          <Form.Item label="排序" name="sort_order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Space size={24}>
            <Form.Item label="启用" name="is_enabled" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="默认选中" name="default_selected" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Card>
  );
}
