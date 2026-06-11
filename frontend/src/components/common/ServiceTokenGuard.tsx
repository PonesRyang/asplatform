import { useState, type ReactNode } from 'react';
import { Card, Input, Button, Spin, Result, Space, Typography } from 'antd';
import { KeyOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useServiceToken } from '../../hooks/useServiceToken';

const { Text, Title } = Typography;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ServiceTokenGuardProps {
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// ServiceTokenGuard — full-page token verification component
//
// Three states:
//   1. No token       → full-page overlay with input + "验证并进入" button
//   2. Verifying      → centered Spin
//   3. Valid          → renders children
//   4. Invalid        → error Result with retry option
// ---------------------------------------------------------------------------
export function ServiceTokenGuard({ children }: ServiceTokenGuardProps) {
  const { serviceToken, isValid, isVerifying, verifyToken, clearToken } =
    useServiceToken();

  const [inputValue, setInputValue] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // -----------------------------------------------------------------------
  // Handle token submission
  // -----------------------------------------------------------------------
  const handleSubmit = async (): Promise<void> => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setLocalError('请输入有效的令牌。');
      return;
    }

    setLocalError(null);
    setIsSubmitting(true);

    try {
      const success = await verifyToken(trimmed);
      if (!success) {
        setLocalError('令牌验证失败，请检查后重试。');
      }
    } catch {
      setLocalError('验证服务暂不可用，请稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Handle Enter key
  // -----------------------------------------------------------------------
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  // -----------------------------------------------------------------------
  // Still verifying an existing stored token
  // -----------------------------------------------------------------------
  if (isVerifying) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: '#f0f2f5',
        }}
      >
        <Spin size="large" tip="正在验证令牌..." />
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Token is valid — render children
  // -----------------------------------------------------------------------
  if (serviceToken && isValid) {
    return <>{children}</>;
  }

  // -----------------------------------------------------------------------
  // Token was invalid / expired — show error with retry
  // -----------------------------------------------------------------------
  if (serviceToken && !isValid && !isVerifying) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: '#f0f2f5',
          padding: 24,
        }}
      >
        <Card style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <Result
            status="warning"
            title="令牌已失效"
            subTitle="您的令牌可能已过期或被停用，请重新输入有效的令牌以继续使用。"
            extra={
              <Button
                type="primary"
                onClick={() => {
                  clearToken();
                  setInputValue('');
                  setLocalError(null);
                }}
              >
                重新输入令牌
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // No token — full-page overlay with input
  // -----------------------------------------------------------------------
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        padding: 24,
      }}
    >
      <Card
        style={{
          maxWidth: 480,
          width: '100%',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.18)',
        }}
        styles={{ body: { padding: 40 } }}
      >
        <Space
          direction="vertical"
          size="large"
          style={{ width: '100%', textAlign: 'center' }}
        >
          {/* Icon */}
          <div>
            <KeyOutlined
              style={{ fontSize: 48, color: '#1a1a2e', marginBottom: 16 }}
            />
          </div>

          {/* Title */}
          <Title level={3} style={{ margin: 0 }}>
            普通用户入口
          </Title>

          {/* Description */}
          <Text type="secondary">
            请使用管理员分配的服务令牌进入前台工具；管理员账号不能在这里登录。
          </Text>

          {/* Input */}
          <Input
            size="large"
            placeholder="请输入您的服务令牌"
            prefix={<KeyOutlined style={{ color: '#bfbfbf' }} />}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setLocalError(null);
            }}
            onKeyDown={handleKeyDown}
            status={localError ? 'error' : undefined}
            allowClear
          />

          {/* Error */}
          {localError && (
            <Text type="danger" style={{ display: 'block' }}>
              {localError}
            </Text>
          )}

          {/* Submit button */}
          <Button
            type="primary"
            size="large"
            block
            icon={<ArrowRightOutlined />}
            loading={isSubmitting}
            onClick={handleSubmit}
            style={{ height: 48 }}
          >
            验证服务令牌并进入
          </Button>
        </Space>
      </Card>
    </div>
  );
}

export default ServiceTokenGuard;
