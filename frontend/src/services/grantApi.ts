import api from './api'
import type { GrantInputState, GrantProject, GrantStepKey } from '../types/grant'

interface GrantProjectApiResponse {
  id: number
  title: string
  status: GrantProject['status']
  current_step: GrantStepKey
  input: GrantProject['input']
  keywords: GrantProject['keywords']
  references: GrantProject['references']
  topics: GrantProject['topics']
  report_sections: GrantProject['reportSections']
  proposal_sections: GrantProject['proposalSections']
  created_at: string
  updated_at: string
}

export interface GrantProjectSummary {
  id: number
  title: string
  status: string
  current_step: GrantStepKey
  fund_type: string
  research_area_path: string[]
  updated_at: string
}

function toApiInput(input: GrantInputState) {
  return {
    fund_type: input.fundType,
    research_area_path: input.researchAreaPath,
    subject: input.subject,
    disease_path: input.diseasePath,
    phenotype: input.phenotype,
    variable_type: input.variableType,
    variable_name: input.variableName,
  }
}

function fromApiProject(project: GrantProjectApiResponse): GrantProject {
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    currentStep: project.current_step,
    input: project.input,
    keywords: project.keywords,
    references: project.references,
    topics: project.topics,
    reportSections: project.report_sections,
    proposalSections: project.proposal_sections,
    updatedAt: project.updated_at,
  }
}

export async function listGrantProjects(token: string): Promise<GrantProjectSummary[]> {
  const response = await api.get<GrantProjectSummary[]>('/api/ai/grant/projects', {
    params: { token },
  })
  return response.data
}

export async function createGrantProject(token: string, input: GrantInputState): Promise<GrantProject> {
  const response = await api.post<GrantProjectApiResponse>('/api/ai/grant/projects', {
    token,
    input: toApiInput(input),
  })
  return fromApiProject(response.data)
}

export async function getGrantProject(projectId: number, token: string): Promise<GrantProject> {
  const response = await api.get<GrantProjectApiResponse>(`/api/ai/grant/projects/${projectId}`, {
    params: { token },
  })
  return fromApiProject(response.data)
}

export async function generateGrantKeywords(projectId: number, token: string): Promise<GrantProject> {
  const response = await api.post<GrantProjectApiResponse>(`/api/ai/grant/projects/${projectId}/keywords/generate`, { token })
  return fromApiProject(response.data)
}

export async function searchGrantReferences(projectId: number, token: string): Promise<GrantProject> {
  const response = await api.post<GrantProjectApiResponse>(`/api/ai/grant/projects/${projectId}/references/search`, { token })
  return fromApiProject(response.data)
}

export async function generateGrantTopics(projectId: number, token: string): Promise<GrantProject> {
  const response = await api.post<GrantProjectApiResponse>(`/api/ai/grant/projects/${projectId}/topics/generate`, { token })
  return fromApiProject(response.data)
}

export async function selectGrantTopic(projectId: number, topicId: string, token: string): Promise<GrantProject> {
  const response = await api.post<GrantProjectApiResponse>(`/api/ai/grant/projects/${projectId}/topics/${topicId}/select`, { token })
  return fromApiProject(response.data)
}

export async function generateGrantReport(projectId: number, token: string): Promise<GrantProject> {
  const response = await api.post<GrantProjectApiResponse>(`/api/ai/grant/projects/${projectId}/report/generate`, { token })
  return fromApiProject(response.data)
}

export async function generateGrantProposal(projectId: number, token: string): Promise<GrantProject> {
  const response = await api.post<GrantProjectApiResponse>(`/api/ai/grant/projects/${projectId}/proposal/generate`, { token })
  return fromApiProject(response.data)
}
