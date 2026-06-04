import { useRef, useEffect, useState } from 'react';
import { Spin } from 'antd';

interface PlotlyChartProps {
  data: Plotly.Data[];
  layout?: Partial<Plotly.Layout>;
  style?: React.CSSProperties;
}

export default function PlotlyChart({ data, layout, style }: PlotlyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function renderChart() {
      if (!containerRef.current || !data || data.length === 0) {
        setIsLoading(false);
        return;
      }

      try {
        const Plotly = await import('plotly.js-dist-min');
        if (!isMounted || !containerRef.current) return;

        const mergedLayout: Partial<Plotly.Layout> = {
          autosize: true,
          ...layout,
        };

        await Plotly.newPlot(containerRef.current, data, mergedLayout, {
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          toImageButtonOptions: {
            format: 'png',
            filename: 'bio_analysis',
            height: 800,
            width: 1200,
          },
        });

        if (isMounted) {
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : '图表渲染失败');
          setIsLoading(false);
        }
      }
    }

    renderChart();

    return () => {
      isMounted = false;
      if (containerRef.current) {
        // Plotly.purge is async but we want to clean up on unmount
        import('plotly.js-dist-min')
          .then((Plotly) => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            Plotly.purge(containerRef.current!);
          })
          .catch(() => {
            /* ignore cleanup errors */
          });
      }
    };
  }, [data, layout]);

  // Handle window resize for Plotly charts
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout>;

    function handleResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (containerRef.current) {
          import('plotly.js-dist-min')
            .then((Plotly) => {
              Plotly.Plots.resize(containerRef.current!);
            })
            .catch(() => {
              /* ignore resize errors */
            });
        }
      }, 150);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 300,
          color: '#ff4d4f',
          ...style,
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: 300, ...style }}>
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.8)',
            zIndex: 10,
          }}
        >
          <Spin tip="图表加载中..." />
        </div>
      )}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', minHeight: 300 }}
      />
    </div>
  );
}
