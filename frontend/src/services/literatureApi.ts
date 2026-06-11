import api from './api'
import type { DocumentItem, LitCompareRequest, GapAnalysisRequest, LiteratureDatabaseOptionsResponse } from '../types/literature'

export async function searchLiterature(
  query: string,
  maxResults?: number,
  databases?: string[],
  token?: string | null,
): Promise<{ results: DocumentItem[]; total: number }> {
  const response = await api.get<{ count?: number; citations?: DocumentItem[]; results?: DocumentItem[]; total?: number }>('/api/literature/search', {
    params: { query, max_results: maxResults, databases: databases?.join(','), token },
  })
  return {
    results: response.data.results ?? response.data.citations ?? [],
    total: response.data.total ?? response.data.count ?? 0,
  }
}

export async function getLiteratureDatabaseOptions(
  token?: string | null,
  module?: 'grant' | 'writing' | 'literature',
): Promise<LiteratureDatabaseOptionsResponse> {
  const response = await api.get<LiteratureDatabaseOptionsResponse>('/api/literature/databases/options', {
    params: {
      ...(token ? { token } : {}),
      ...(module ? { module } : {}),
    },
  })
  return response.data
}

export async function extractLitFiles(files: File[], token?: string | null): Promise<DocumentItem[]> {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  if (token) formData.append('token', token)
  const response = await api.post<{ documents: DocumentItem[] }>('/api/lit-compare/extract', formData)
  return response.data.documents
}

export async function compareLiterature(documents: DocumentItem[], token?: string | null): Promise<Record<string, unknown>> {
  const data: LitCompareRequest & { token?: string | null } = { documents, token }
  const response = await api.post<Record<string, unknown>>('/api/lit-compare/analyze', data)
  return response.data
}

export async function gapAnalysis(data: GapAnalysisRequest, token?: string | null): Promise<Record<string, unknown>> {
  const [startDocument, endDocument] = data.documents ?? []
  const response = await api.post<Record<string, unknown>>('/api/lit-compare/gap-analysis', {
    startDocument,
    endDocument,
    comparison: data.research_area,
    token,
  })
  return response.data
}
