// @ts-nocheck
import { useMemo } from 'react';
import { Typography, Spin, Card, Empty, Descriptions, Tag } from 'antd';
import {
  BarChartOutlined,
  TableOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import PlotlyChart from '../../components/common/PlotlyChart';
import type { AnalysisResult, ChartConfig } from '../../types/bio';

const { Title, Text } = Typography;

interface BioContentProps {
  result: AnalysisResult | null;
  isLoading: boolean;
}

/**
 * Try to convert a ChartConfig into Plotly-compatible data.
 * The backend may return plot-ready data in chart_configs, or
 * it may return configuration that needs translation.
 */
function convertChartConfigToPlotlyData(
  config: ChartConfig,
  _index: number,
): { data: Plotly.Data[]; layout: Partial<Plotly.Layout> } {
  const plotlyData: Plotly.Data[] = [];

  // If config.data is an array of Plotly-like traces, use them directly
  if (Array.isArray(config.data) && config.data.length > 0) {
    const firstItem = config.data[0] as Record<string, unknown>;
    // Check if it looks like a Plotly trace (has type, or x/y)
    if (
      firstItem &&
      (typeof firstItem.type === 'string' ||
        'x' in firstItem ||
        'y' in firstItem ||
        'values' in firstItem)
    ) {
      for (const item of config.data) {
        plotlyData.push(item as unknown as Plotly.Data);
      }
    } else {
      // Raw data — create a basic trace
      plotlyData.push(createTraceFromData(config, config.data));
    }
  } else {
    // No data — create an empty trace placeholder
    plotlyData.push({
      type: config.type as Plotly.Data['type'],
      name: config.title,
      x: [],
      y: [],
    } as Plotly.Data);
  }

  const layout: Partial<Plotly.Layout> = {
    title: config.title || '',
    xaxis: config.x_label ? { title: config.x_label } : {},
    yaxis: config.y_label ? { title: config.y_label } : {},
    ...(config.options as Partial<Plotly.Layout> | undefined),
  };

  return { data: plotlyData, layout };
}

function createTraceFromData(
  config: ChartConfig,
  rawData: Record<string, unknown>[],
): Plotly.Data {
  const keys = rawData.length > 0 ? Object.keys(rawData[0]) : [];
  const xKey = keys[0];
  const yKey = keys.length > 1 ? keys[1] : keys[0];

  return {
    type: (config.type as Plotly.Data['type']) || 'scatter',
    name: config.title,
    x: rawData.map((r) => r[xKey] as string | number | null),
    y: rawData.map((r) => r[yKey] as string | number | null),
  } as Plotly.Data;
}

/**
 * Check if statistics contains HTML content (e.g., from regression
 * model summaries rendered by the backend).
 */
function findHtmlStats(
  stats: Record<string, unknown>,
): string | null {
  // Common keys for HTML stats content
  const htmlKeys = ['summary_html', 'html', 'table_html', 'model_summary', 'report_html'];
  for (const key of htmlKeys) {
    if (typeof stats[key] === 'string' && stats[key].includes('<')) {
      return stats[key] as string;
    }
  }
  // Also check if a top-level string value looks like HTML
  for (const [, value] of Object.entries(stats)) {
    if (typeof value === 'string' && value.includes('<') && value.includes('>')) {
      return value;
    }
  }
  return null;
}

/**
 * Extract displayable key-value pairs from statistics, excluding
 * HTML strings and deeply nested objects.
 */
function extractFlatStats(
  stats: Record<string, unknown>,
): { label: string; value: string }[] {
  const entries: { label: string; value: string }[] = [];

  for (const [key, value] of Object.entries(stats)) {
    if (value === null || value === undefined) continue;
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    if (typeof value === 'string' && value.includes('<')) {
      continue; // Skip HTML strings
    }

    if (typeof value === 'number') {
      entries.push({ label, value: Number.isInteger(value) ? value.toString() : value.toFixed(4) });
    } else if (typeof value === 'boolean' || typeof value === 'string') {
      entries.push({ label, value: String(value) });
    } else if (Array.isArray(value) && value.every((v) => typeof v === 'number')) {
      entries.push({
        label,
        value: (value as number[]).map((v) => v.toFixed(4)).join(', '),
      });
    }
  }

  return entries;
}

export default function BioContent({ result, isLoading }: BioContentProps) {
  const chartPanels = useMemo(() => {
    if (!result?.chart_configs || result.chart_configs.length === 0) return null;
    return result.chart_configs.map((config, idx) => {
      const { data, layout } = convertChartConfigToPlotlyData(config, idx);
      return { key: idx, title: config.title || `图表 ${idx + 1}`, data, layout };
    });
  }, [result]);

  const htmlStats = useMemo(() => {
    if (!result?.statistics) return null;
    return findHtmlStats(result.statistics);
  }, [result]);

  const flatStats = useMemo(() => {
    if (!result?.statistics) return [];
    return extractFlatStats(result.statistics);
  }, [result]);

  const hasStats = htmlStats || flatStats.length > 0;

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          minHeight: 400,
        }}
      >
        <Spin size="large" tip="分析中...">
          <div style={{ padding: 50 }} />
        </Spin>
      </div>
    );
  }

  // ---- Empty state ----
  if (!result) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
        }}
      >
        <Empty
          description={
            <Text type="secondary" style={{ fontSize: 14 }}>
              运行分析后结果将显示在这里
            </Text>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  // ---- Error in result ----
  if (!result.success && result.error) {
    return (
      <div style={{ padding: 24 }}>
        <Card title="分析结果" style={{ borderColor: '#ff4d4f' }}>
          <Text type="danger">{result.error}</Text>
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: 24,
      }}
    >
      {/* ---- Analysis Summary ---- */}
      {result.summary && (
        <Card
          size="small"
          style={{ marginBottom: 16 }}
          title={
            <span>
              <InfoCircleOutlined style={{ marginRight: 6 }} />
              分析概要
            </span>
          }
        >
          <Text>{result.summary}</Text>
        </Card>
      )}

      {/* ---- Charts ---- */}
      {chartPanels && chartPanels.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 12 }}>
            <BarChartOutlined style={{ marginRight: 6 }} />
            可视化结果
          </Title>
          {chartPanels.map((panel) => (
            <Card
              key={panel.key}
              title={panel.title}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <PlotlyChart
                data={panel.data}
                layout={panel.layout}
                style={{ minHeight: 400 }}
              />
            </Card>
          ))}
        </div>
      )}

      {/* ---- Statistics ---- */}
      {hasStats && (
        <div style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 12 }}>
            <TableOutlined style={{ marginRight: 6 }} />
            统计结果
          </Title>

          {/* HTML stats (e.g., regression summary tables) */}
          {htmlStats && (
            <Card
              title="详细报告"
              size="small"
              style={{ marginBottom: 16 }}
            >
              <div
                style={{
                  maxHeight: 600,
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}
                dangerouslySetInnerHTML={{ __html: htmlStats }}
              />
            </Card>
          )}

          {/* Key-value stats */}
          {flatStats.length > 0 && (
            <Card title="统计指标" size="small">
              <Descriptions
                column={{ xs: 1, sm: 2, md: 2, lg: 3 }}
                size="small"
                bordered
              >
                {flatStats.map((stat) => (
                  <Descriptions.Item
                    key={stat.label}
                    label={stat.label}
                  >
                    <Tag color="blue" style={{ fontSize: 13 }}>
                      {stat.value}
                    </Tag>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Card>
          )}
        </div>
      )}

      {/* ---- No results fallback ---- */}
      {!chartPanels && !hasStats && (
        <Empty
          description="该分析未返回可视化或统计数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </div>
  );
}
