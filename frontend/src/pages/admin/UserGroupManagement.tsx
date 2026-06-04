import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Card,
  Space,
  message,
  Modal,
  Form,
  Input,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
} from '../../services/adminApi';
import type { UserGroup, CreateUserGroupRequest } from '../../types/admin';

// ---------------------------------------------------------------------------
// UserGroupManagement — 用户组管理 CRUD
// ---------------------------------------------------------------------------
export default function UserGroupManagement() {
  // ---------- data ----------
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // ---------- modal ----------
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [form] = Form.useForm();

  // ---------- delete ----------
  const [deleteTarget, setDeleteTarget] = useState<UserGroup | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ---------- fetch ----------
  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listGroups();
      setGroups(data);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '加载用户组列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // ---------- actions ----------
  const openCreate = () => {
    setEditingGroup(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (group: UserGroup) => {
    setEditingGroup(group);
    form.setFieldsValue({
      name: group.name,
      description: group.description ?? '',
      permissions: group.permissions,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingGroup(null);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setModalLoading(true);
      if (editingGroup) {
        await updateGroup(editingGroup.id, values);
        message.success('用户组更新成功');
      } else {
        await createGroup(values);
        message.success('用户组创建成功');
      }
      closeModal();
      await fetchGroups();
    } catch (err: any) {
      if (err?.errorFields) return; // form validation error
      message.error(err?.response?.data?.detail || '操作失败');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteGroup(deleteTarget.id);
      message.success('用户组已删除');
      setDeleteTarget(null);
      await fetchGroups();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '删除失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ---------- table columns ----------
  const columns: ColumnsType<UserGroup> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (v: string | null) => v || '-',
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (v: string) => v || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: UserGroup) => (
        <Space>
          <Button type="link" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button type="link" danger onClick={() => setDeleteTarget(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // ---------- render ----------
  return (
    <Card
      title="用户组管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          添加用户组
        </Button>
      }
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={groups}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
      />

      {/* ---- Create / Edit Modal ---- */}
      <Modal
        title={editingGroup ? '编辑用户组' : '添加用户组'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={modalLoading}
        destroyOnClose
        forceRender
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入用户组名称' }]}
          >
            <Input placeholder="用户组名称" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="描述（可选）" />
          </Form.Item>

          <Form.Item
            name="permissions"
            label="权限"
            rules={[{ required: true, message: '请输入权限标识' }]}
          >
            <Input placeholder="权限标识字符串" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---- Delete Confirmation ---- */}
      <Modal
        title="确认删除"
        open={!!deleteTarget}
        onOk={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLoading={deleteLoading}
        okText="删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <p>
          确定删除用户组「{deleteTarget?.name}」吗？此操作不可撤销。
        </p>
      </Modal>
    </Card>
  );
}
