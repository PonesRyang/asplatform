import { Spin } from 'antd';

export interface LoadingSpinnerProps {
  tip?: string;
}

export function LoadingSpinner({ tip }: LoadingSpinnerProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200,
        width: '100%',
      }}
    >
      <Spin tip={tip} size="large">
        {/* Ant Design Spin with tip requires a child */}
        <div style={{ padding: 50 }} />
      </Spin>
    </div>
  );
}

export default LoadingSpinner;
