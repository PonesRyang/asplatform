import api from './api'
import type {
  TopicGenerationRequest,
  TopicAnalysisRequest,
  TopicRefineRequest,
  ThesisCreateRequest,
  ThesisProject,
} from '../types/thesis'

export async function generateTopics(data: TopicGenerationRequest): Promise<{ topics: string[] }> {
  const response = await api.post<{ topics: string[] }>('/api/ai/topic/generate', data)
  return response.data
}

export async function analyzeTopic(data: TopicAnalysisRequest): Promise<Record<string, unknown>> {
  const response = await api.post<Record<string, unknown>>('/api/ai/topic/analyze', data)
  return response.data
}

export async function refineTopic(data: TopicRefineRequest): Promise<{ refined_topic: string }> {
  const response = await api.post<{ refined_topic: string }>('/api/ai/topic/refine', data)
  return response.data
}

export async function createAndOutline(data: ThesisCreateRequest): Promise<ThesisProject> {
  const response = await api.post<ThesisProject>('/api/ai/topic/create-and-outline', data)
  return response.data
}
