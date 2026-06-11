export interface ThesisProject {
  id: number
  token: string
  title: string | null
  status: string
  thesis_type: string
  discipline: string
  language: string
  length: string
  created_at: string
  updated_at: string
}

export interface ThesisStep {
  step_type: string
  step_title: string
  is_completed: boolean
  content: string | null
  completed_at: string | null
}

export interface ThesisCreateRequest {
  token: string
  thesis_type: string
  discipline: string
  language: string
  length: string
}

export interface TopicGenerationRequest {
  token: string
  discipline: string
  thesis_type: string
  title?: string
}

export interface TopicAnalysisRequest {
  token: string
  topic: string
}

export interface TopicRefineRequest {
  token: string
  original_topic: string
  refinement_instructions: string
}

export interface ThesisOutlineRequest {
  project_id: number
  token: string
  instructions?: string
  databases?: string[]
}

export interface ThesisFullTextRequest {
  project_id: number
  token?: string
  outline: string
  style?: string
  references?: any[]
  style_example?: any
  databases?: string[]
}

export interface ThesisRefineRequest {
  project_id: number
  token: string
  instructions: string
  section_type?: string
}

export interface LiteratureSearchRequest {
  query: string
  max_results?: number
  databases?: string[]
  token?: string
}

export interface AIProcessRequest {
  token: string
  text: string
  mode: string
  instructions?: string
  discipline?: string
  thesis_type?: string
  language?: string
}

export interface AIProcessResponse {
  result: string
  mode: string
  token_usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface ReferenceUploadItem {
  id?: number
  project_id?: number
  title: string
  authors: string
  year: number | null
  journal: string | null
  doi: string | null
  abstract: string | null
  citation: string
  raw_text: string
  is_validated: boolean
  validation_errors: string | null
  created_at: string
}
