import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ConfirmModalProps {
  open: boolean;
  title?: string;
  content: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  confirmText?: string;
  cancelText?: string;
}

// ---------------------------------------------------------------------------
// Reusable confirmation modal — typically used for delete confirmations
// ---------------------------------------------------------------------------
export function ConfirmModal({
  open,
  title = '确认操作',
  content,
  onConfirm,
  onCancel,
  loading = false,
  confirmText = '确认删除',
  cancelText = '取消',
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      title={
        <span>
          <ExclamationCircleOutlined
            style={{ color: '#ff4d4f', marginRight: 8 }}
          />
          {title}
        </span>
      }
      okText={confirmText}
      cancelText={cancelText}
      okButtonProps={{ danger: true, loading }}
      onOk={onConfirm}
      onCancel={onCancel}
      centered
      destroyOnClose
    >
      <p>{content}</p>
    </Modal>
  );
}

export default ConfirmModal;
