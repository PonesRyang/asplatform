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
  const response = await api.post<ThesisProject>('/api/ai/thesis/create', data)
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

export async function uploadReferences(formData: FormData): Promise<any> {
  const response = await api.post<any>('/api/ai/thesis/references/upload', formData)
  return response.data
}

export async function getProjectReferences(projectId: number, token: string, databases?: string[]): Promise<any> {
  const response = await api.get<any>(`/api/ai/thesis/${projectId}/references`, {
    params: {
      token,
      ...(databases && databases.length > 0 ? { databases: databases.join(',') } : {}),
    },
  })
  return response.data
}

export async function saveUploadedReferences(projectId: number, data: { token: string; references: any[]; replace?: boolean }): Promise<any> {
  const response = await api.post<any>(`/api/ai/thesis/${projectId}/references/uploaded`, data)
  return response.data
}

export async function validateReferences(projectId: number, token?: string): Promise<{ project_id: number; project_title: string; validation: unknown }> {
  const response = await api.post<{ project_id: number; project_title: string; validation: unknown }>(`/api/ai/thesis/${projectId}/validate-references`, null, {
    params: { token },
  })
  return response.data
}
