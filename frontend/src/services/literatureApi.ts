import api from './api'
import type { DocumentItem, LitCompareRequest, GapAnalysisRequest } from '../types/literature'

export async function searchLiterature(
  query: string,
  maxResults?: number,
  databases?: string[],
): Promise<{ results: DocumentItem[]; total: number }> {
  const response = await api.get<{ results: DocumentItem[]; total: number }>('/api/literature/search', {
    params: { query, max_results: maxResults, databases: databases?.join(',') },
  })
  return response.data
}

export async function extractLitFiles(files: File[]): Promise<DocumentItem[]> {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  const response = await api.post<{ documents: DocumentItem[] }>('/api/lit-compare/extract', formData)
  return response.data.documents
}

export async function compareLiterature(documents: DocumentItem[]): Promise<Record<string, unknown>> {
  const data: LitCompareRequest = { documents }
  const response = await api.post<Record<string, unknown>>('/api/lit-compare/analyze', data)
  return response.data
}

export async function gapAnalysis(data: GapAnalysisRequest): Promise<Record<string, unknown>> {
  const response = await api.post<Record<string, unknown>>('/api/lit-compare/gap-analysis', data)
  return response.data
}
