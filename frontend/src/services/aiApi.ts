import api from './api'
import type { AIProcessRequest, AIProcessResponse } from '../types/thesis'

export async function processText(data: AIProcessRequest): Promise<AIProcessResponse> {
  const response = await api.post<AIProcessResponse>('/api/ai/process', data)
  return response.data
}
