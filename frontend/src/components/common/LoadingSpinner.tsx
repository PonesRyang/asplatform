import { Spin, Typography } from 'antd';

const { Text } = Typography;

export interface LoadingSpinnerProps {
  tip?: string;
  description?: string;
  steps?: string[];
}

export function LoadingSpinner({ tip = '正在处理', description, steps = [] }: LoadingSpinnerProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 280,
        width: '100%',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 'min(520px, 100%)',
          border: '1px solid #ececf0',
          borderRadius: 8,
          background: '#fff',
          boxShadow: '0 8px 24px rgba(18, 18, 35, 0.06)',
          padding: '28px 32px',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <Spin size="large" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#1f1f2f', lineHeight: 1.4 }}>
              {tip}
            </div>
            {description && (
              <Text type="secondary" style={{ display: 'block', marginTop: 6, lineHeight: 1.7 }}>
                {description}
              </Text>
            )}
          </div>
        </div>

        {steps.length > 0 && (
          <div style={{ marginTop: 22, display: 'grid', gap: 10 }}>
            {steps.map((step, index) => (
              <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: index === 0 ? '#1a1a2e' : '#f1f2f5',
                    color: index === 0 ? '#fff' : '#8c8c8c',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </span>
                <Text type={index === 0 ? undefined : 'secondary'} style={{ lineHeight: 1.6 }}>
                  {step}
                </Text>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LoadingSpinner;
