export interface AnalyzeRequest {
  tool_key: string
  file_id?: string
  data?: Record<string, unknown>[]
  parameters: Record<string, unknown>
  column_types?: Record<string, string>
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
