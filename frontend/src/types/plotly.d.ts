declare module 'react-plotly.js' {
  import type { ComponentType, CSSProperties } from 'react';

  interface PlotParams {
    data: Plotly.Data[];
    layout?: Partial<Plotly.Layout>;
    config?: Partial<Plotly.Config>;
    frames?: Plotly.Frame[];
    style?: CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    onInitialized?: (figure: Plotly.Figure, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: Plotly.Figure, graphDiv: HTMLElement) => void;
    onPurge?: (figure: Plotly.Figure, graphDiv: HTMLElement) => void;
    onError?: (err: Error) => void;
    onClick?: (event: Plotly.PlotMouseEvent) => void;
    onHover?: (event: Plotly.PlotMouseEvent) => void;
    onUnHover?: (event: Plotly.PlotMouseEvent) => void;
    onSelected?: (event: Plotly.PlotSelectionEvent) => void;
    divId?: string;
    revision?: number;
  }

  const Plot: ComponentType<PlotParams>;
  export default Plot;
}

declare namespace Plotly {
  interface Data {
    type?: string;
    x?: (string | number | null)[];
    y?: (string | number | null)[];
    z?: (number | null)[][];
    name?: string;
    mode?: string;
    marker?: {
      color?: string | string[];
      size?: number | number[];
      symbol?: string;
      colorscale?: string;
      showscale?: boolean;
      colorbar?: Record<string, unknown>;
    };
    line?: {
      color?: string;
      width?: number;
      dash?: string;
    };
    text?: string[];
    hoverinfo?: string;
    hovertext?: string[];
    hovertemplate?: string;
    orientation?: string;
    xaxis?: string;
    yaxis?: string;
    showlegend?: boolean;
    legendgroup?: string;
    opacity?: number;
    [key: string]: unknown;
  }

  interface Layout {
    title?: string | { text: string; font?: Record<string, unknown> };
    xaxis?: Record<string, unknown>;
    yaxis?: Record<string, unknown>;
    height?: number;
    width?: number;
    autosize?: boolean;
    showlegend?: boolean;
    legend?: Record<string, unknown>;
    margin?: { l?: number; r?: number; t?: number; b?: number; pad?: number };
    hovermode?: string;
    barmode?: string;
    boxmode?: string;
    violinmode?: string;
    template?: string;
    paper_bgcolor?: string;
    plot_bgcolor?: string;
    font?: Record<string, unknown>;
    [key: string]: unknown;
  }

  interface Config {
    responsive?: boolean;
    displayModeBar?: boolean;
    displaylogo?: boolean;
    modeBarButtonsToRemove?: string[];
    modeBarButtonsToAdd?: unknown[];
    toImageButtonOptions?: Record<string, unknown>;
    scrollZoom?: boolean;
    [key: string]: unknown;
  }

  interface Frame {
    name?: string;
    data?: Data[];
    [key: string]: unknown;
  }

  interface PlotMouseEvent {
    points: Array<{
      x: unknown;
      y: unknown;
      curveNumber: number;
      pointNumber: number;
      data: Data;
    }>;
    event: MouseEvent;
  }

  interface PlotSelectionEvent {
    points: Array<{
      x: unknown;
      y: unknown;
      curveNumber: number;
      pointNumber: number;
      data: Data;
    }>;
    range?: {
      x: [number, number];
      y: [number, number];
    };
    lassoPoints?: { x: number; y: number }[];
  }

  interface Figure {
    data: Data[];
    layout: Layout;
    frames?: Frame[];
  }
}
