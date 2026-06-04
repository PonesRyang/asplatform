import api from './api'
import type {
  ThesisProject,
  ThesisStep,
  ThesisCreateRequest,
  ThesisOutlineRequest,
  ThesisFullTextRequest,
  ThesisRefineRequest,
} from '../types/thesis'

export async function createProject(data: ThesisCreateRequest): Promise<ThesisProject> {
  const response = await api.post<ThesisProject>('/api/ai/thesis', data)
  return response.data
}

export async function listProjects(token: string): Promise<ThesisProject[]> {
  const response = await api.get<ThesisProject[]>('/api/ai/thesis/projects', {
    params: { token },
  })
  return response.data
}

export async function getProjectSteps(projectId: number, token: string): Promise<ThesisStep[]> {
  const response = await api.get<ThesisStep[]>(`/api/ai/thesis/${projectId}/steps`, {
    params: { token },
  })
  return response.data
}

export async function generateOutline(data: ThesisOutlineRequest): Promise<{ outline: string }> {
  const response = await api.post<{ outline: string }>('/api/ai/thesis/outline', data)
  return response.data
}

export async function saveOutline(data: ThesisOutlineRequest & { outline: string }): Promise<ThesisStep> {
  const response = await api.post<ThesisStep>('/api/ai/thesis/outline/save', data)
  return response.data
}

export async function generateFulltext(data: ThesisFullTextRequest): Promise<{ full_text: string }> {
  const response = await api.post<{ full_text: string }>('/api/ai/thesis/fulltext', data)
  return response.data
}

export async function saveFulltext(data: { project_id: number; token: string; content: string }): Promise<ThesisStep> {
  const response = await api.post<ThesisStep>('/api/ai/thesis/fulltext/save', data)
  return response.data
}

export async function saveDraft(data: { project_id: number; token: string; content: string; section?: string }): Promise<ThesisStep> {
  const response = await api.post<ThesisStep>('/api/ai/thesis/draft/save', data)
  return response.data
}

export async function refineThesis(data: ThesisRefineRequest): Promise<{ refined_content: string }> {
  const response = await api.post<{ refined_content: string }>('/api/ai/thesis/refine', data)
  return response.data
}

export async function exportOutline(data: { project_id: number; token: string }): Promise<Blob> {
  const response = await api.post('/api/ai/thesis/outline/export', data, {
    responseType: 'blob',
  })
  return response.data
}

export async function exportThesis(projectId: number, token: string): Promise<Blob> {
  const response = await api.get(`/api/ai/thesis/${projectId}/export`, {
    params: { token },
    responseType: 'blob',
  })
  return response.data
}

export async function uploadReferences(formData: FormData): Promise<{ count: number; items: unknown[] }> {
  const response = await api.post<{ count: number; items: unknown[] }>('/api/ai/thesis/references/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function validateReferences(projectId: number): Promise<{ valid_count: number; invalid_count: number; details: unknown[] }> {
  const response = await api.post<{ valid_count: number; invalid_count: number; details: unknown[] }>(`/api/ai/thesis/${projectId}/references/validate`)
  return response.data
}
