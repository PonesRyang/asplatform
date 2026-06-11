import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import {
  createGrantConfigItem,
  deleteGrantConfigItem,
  listGrantConfigItems,
  updateGrantConfigItem,
} from '../../services/adminApi';
import type {
  GrantConfigCategory,
  GrantConfigItem,
} from '../../types/admin';

const { Text } = Typography;

const categories: Array<{ key: GrantConfigCategory; label: string; hierarchical: boolean }> = [
  { key: 'fund_type', label: '基金类型', hierarchical: false },
  { key: 'research_area', label: '研究方向', hierarchical: true },
  { key: 'disease', label: '疾病列表', hierarchical: true },
  { key: 'variable_type', label: '主变量类型', hierarchical: false },
  { key: 'phenotype', label: '表型问题', hierarchical: false },
];

interface ConfigFormValues {
  label: string;
  value?: string;
  parent_id?: number | null;
  sort_order?: number;
  is_active?: boolean;
  source?: string;
}

export default function GrantConfigManagement() {
  const [activeCategory, setActiveCategory] = useState<GrantConfigCategory>('fund_type');
  const [items, setItems] = useState<GrantConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GrantConfigItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<ConfigFormValues>();

  const activeMeta = categories.find(item => item.key === activeCategory) || categories[0];

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listGrantConfigItems(activeCategory, search.trim() || undefined);
      setItems(data);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '加载申报配置失败');
    } finally {
      setLoading(false);
    }
  }, [activeCategory, search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const parentOptions = useMemo(() => (
    items
      .filter(item => item.id !== editingItem?.id)
      .map(item => ({
        label: item.parent_label ? `${item.parent_label} / ${item.label}` : item.label,
        value: item.id,
      }))
  ), [editingItem?.id, items]);

  const openCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true, sort_order: items.length + 1, parent_id: null });
    setModalOpen(true);
  };

  const openEdit = (item: GrantConfigItem) => {
    setEditingItem(item);
    form.setFieldsValue({
      label: item.label,
      value: item.value,
      parent_id: item.parent_id ?? null,
      sort_order: item.sort_order,
      is_active: item.is_active,
      source: item.source || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editingItem) {
        await updateGrantConfigItem(editingItem.id, values);
        message.success('配置项已更新');
      } else {
        await createGrantConfigItem({
          category: activeCategory,
          label: values.label,
          value: values.value,
          parent_id: values.parent_id ?? null,
          sort_order: values.sort_order ?? 0,
          is_active: values.is_active ?? true,
          source: values.source,
        });
        message.success('配置项已新增');
      }
      setModalOpen(false);
      await fetchItems();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: GrantConfigItem) => {
    Modal.confirm({
      title: '删除配置项',
      content: `确认删除「${item.label}」？如果它有下级配置项，需要先迁移或删除下级。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteGrantConfigItem(item.id);
          message.success('配置项已删除');
          await fetchItems();
        } catch (error: any) {
          message.error(error?.response?.data?.detail || '删除失败');
        }
      },
    });
  };

  const columns: ColumnsType<GrantConfigItem> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    {
      title: '名称',
      dataIndex: 'label',
      render: (value: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.value}</Text>
        </Space>
      ),
    },
    {
      title: '上级',
      dataIndex: 'parent_label',
      width: 180,
      render: value => value || <Text type="secondary">顶级</Text>,
    },
    { title: '排序', dataIndex: 'sort_order', width: 90 },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 100,
      render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? '启用' : '停用'}</Tag>,
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 180,
      render: value => value || <Text type="secondary">手工维护</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="申报配置管理"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增配置项</Button>}
      style={{ borderRadius: 8 }}
    >
      <Tabs
        activeKey={activeCategory}
        onChange={(key) => {
          setActiveCategory(key as GrantConfigCategory);
          setSearch('');
        }}
        items={categories.map(category => ({ key: category.key, label: category.label }))}
      />

      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder={`搜索${activeMeta.label}`}
          enterButton={<SearchOutlined />}
          value={search}
          onChange={event => setSearch(event.target.value)}
          onSearch={fetchItems}
          style={{ width: 320 }}
        />
        <Tag color="blue">{items.length} 项</Tag>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />

      <Modal
        title={editingItem ? '编辑配置项' : `新增${activeMeta.label}`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="名称" name="label" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="配置值" name="value" tooltip="为空时默认使用名称">
            <Input />
          </Form.Item>
          {activeMeta.hierarchical && (
            <Form.Item label="上级配置项" name="parent_id">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={parentOptions}
                placeholder="不选择则为顶级"
              />
            </Form.Item>
          )}
          <Form.Item label="排序" name="sort_order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="来源" name="source">
            <Input />
          </Form.Item>
          <Form.Item label="启用" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
