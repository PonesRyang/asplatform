// @ts-nocheck
import { useMemo } from 'react';
import { Typography, Spin, Card, Empty, Descriptions, Tag } from 'antd';
import PlotlyChart from '../../components/common/PlotlyChart';

const { Title, Text } = Typography;

interface BioContentProps {
  result: any;
  isLoading: boolean;
}

function extractFlatStats(stats: any): { label: string; value: string }[] {
  if (!stats || typeof stats !== 'object') return [];
  const entries: { label: string; value: string }[] = [];
  for (const [key, value] of Object.entries(stats)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'object') continue;
    const label = key.replace(/_/g, ' ');
    if (typeof value === 'number') {
      entries.push({ label, value: Number.isInteger(value) ? String(value) : value.toFixed(4) });
    } else if (typeof value === 'string' && value.length < 500) {
      entries.push({ label, value });
    }
  }
  return entries;
}

export default function BioContent({ result, isLoading }: BioContentProps) {
  const plotData = result?.plot_data;
  const plotLayout = result?.plot_layout || {};
  const stats = result?.stats;
  const flatStats = useMemo(() => extractFlatStats(stats), [stats]);
  const hasPlot = plotData && Array.isArray(plotData) && plotData.length > 0;
  const hasStats = flatStats.length > 0;
  const htmlStats = typeof stats === 'string' ? stats : null;

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" tip="分析中..." />
      </div>
    );
  }

  if (!result) {
    return <Empty description="运行分析后结果将显示在这里" />;
  }

  return (
    <div>
      {/* Chart */}
      {hasPlot && (
        <Card size="small" title="图表" style={{ marginBottom: 16 }}>
          <PlotlyChart
            data={plotData}
            layout={plotLayout}
            style={{ width: '100%', minHeight: 400 }}
          />
        </Card>
      )}

      {/* Stats */}
      {hasStats && (
        <Card size="small" title="统计结果" style={{ marginBottom: 16 }}>
          <Descriptions column={1} size="small" bordered>
            {flatStats.map((s, i) => (
              <Descriptions.Item key={i} label={s.label} labelStyle={{ fontWeight: 600 }}>
                {s.value}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Card>
      )}

      {/* HTML stats (regression summaries etc.) */}
      {htmlStats && !hasStats && (
        <Card size="small" title="分析报告" style={{ marginBottom: 16 }}>
          <div dangerouslySetInnerHTML={{ __html: htmlStats }} style={{ maxHeight: 400, overflow: 'auto' }} />
        </Card>
      )}

      {/* No data */}
      {!hasPlot && !hasStats && !htmlStats && (
        <Empty description="分析完成，但无图表数据" />
      )}
    </div>
  );
}
