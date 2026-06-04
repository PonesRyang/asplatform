import api from './api'
import type { AnalyzeRequest, AnalysisResult } from '../types/bio'

export async function analyzeBioData(data: AnalyzeRequest): Promise<AnalysisResult> {
  const response = await api.post<AnalysisResult>('/api/bio/analyze', data)
  return response.data
}
