export interface AnalyzeRequest {
  type: string
  data: Record<string, unknown>[]
  config: Record<string, unknown>
}

export interface ChartConfig {
  type: string
  title: string
  x_label: string
  y_label: string
  data: unknown
  options?: Record<string, unknown>
}

export interface AnalysisResult {
  success: boolean
  tool_key: string
  chart_configs: ChartConfig[]
  summary: string
  statistics: Record<string, unknown>
  message?: string
  error?: string
}
