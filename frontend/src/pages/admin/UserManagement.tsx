import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Card,
  Space,
  message,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listGroups,
} from '../../services/adminApi';
import type {
  AdminUserResponse,
  UserGroup,
  CreateAdminUserRequest,
  UpdateAdminUserRequest,
} from '../../types/admin';

// ---------------------------------------------------------------------------
// UserManagement — 用户管理 CRUD
// ---------------------------------------------------------------------------
export default function UserManagement() {
  // ---------- data ----------
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // ---------- modal ----------
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserResponse | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [form] = Form.useForm();

  // ---------- delete ----------
  const [deleteTarget, setDeleteTarget] = useState<AdminUserResponse | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ---------- fetch ----------
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, groupsData] = await Promise.all([
        listUsers(),
        listGroups(),
      ]);
      setUsers(usersData);
      setGroups(groupsData);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------- actions ----------
  const openCreate = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true });
    setModalOpen(true);
  };

  const openEdit = (user: AdminUserResponse) => {
    setEditingUser(user);
    form.setFieldsValue({
      full_name: user.full_name ?? '',
      email: user.email ?? '',
      is_active: user.is_active,
      group_id: user.group_id ?? undefined,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setModalLoading(true);
      if (editingUser) {
        const payload: UpdateAdminUserRequest = {
          full_name: values.full_name || undefined,
          email: values.email || undefined,
          is_active: values.is_active,
          group_id: values.group_id || undefined,
        };
        await updateUser(editingUser.id, payload);
        message.success('用户更新成功');
      } else {
        const payload: CreateAdminUserRequest = {
          username: values.username,
          password: values.password,
          full_name: values.full_name || undefined,
          email: values.email || undefined,
          is_active: values.is_active,
          group_id: values.group_id || undefined,
        };
        await createUser(payload);
        message.success('用户创建成功');
      }
      closeModal();
      await fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || '操作失败');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteUser(deleteTarget.id);
      message.success('用户已删除');
      setDeleteTarget(null);
      await fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '删除失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ---------- table columns ----------
  const columns: ColumnsType<AdminUserResponse> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    {
      title: '姓名',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (v: string | null) => v || '-',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (v: string | null) => v || '-',
    },
    {
      title: '用户组',
      dataIndex: 'group',
      key: 'group',
      render: (g: UserGroup | null) => (g ? <Tag>{g.name}</Tag> : '-'),
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
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: AdminUserResponse) => (
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
      title="用户管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          添加用户
        </Button>
      }
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
      />

      {/* ---- Create / Edit Modal ---- */}
      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={modalLoading}
        destroyOnClose
        forceRender
      >
        <Form form={form} layout="vertical">
          {!editingUser && (
            <>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="用户名" />
              </Form.Item>

              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password placeholder="密码" />
              </Form.Item>
            </>
          )}

          <Form.Item name="full_name" label="姓名">
            <Input placeholder="姓名（可选）" />
          </Form.Item>

          <Form.Item name="email" label="邮箱">
            <Input placeholder="邮箱（可选）" />
          </Form.Item>

          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="group_id" label="用户组">
            <Select
              allowClear
              placeholder="选择用户组（可选）"
              options={groups.map((g) => ({
                label: g.name,
                value: g.id,
              }))}
            />
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
          确定删除用户「{deleteTarget?.username}」吗？此操作不可撤销。
        </p>
      </Modal>
    </Card>
  );
}
