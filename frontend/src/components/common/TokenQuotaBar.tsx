import { Progress } from 'antd';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface TokenQuotaBarProps {
  total: number;
  used: number;
}

// ---------------------------------------------------------------------------
// Token quota usage bar
// ---------------------------------------------------------------------------
export function TokenQuotaBar({ total, used }: TokenQuotaBarProps) {
  const percent = total > 0 ? Math.round((used / total) * 100) : 0;

  return (
    <div style={{ minWidth: 200 }}>
      <Progress
        percent={percent}
        status={percent >= 90 ? 'exception' : percent >= 70 ? 'normal' : 'active'}
        format={() => `${used} / ${total} tokens`}
        strokeColor={
          percent >= 90 ? '#ff4d4f' : percent >= 70 ? '#faad14' : '#1a1a2e'
        }
      />
    </div>
  );
}

export default TokenQuotaBar;
