export interface DocumentItem {
  id?: string
  title: string
  authors: string
  year: number | null
  journal: string | null
  doi: string | null
  abstract: string
  content?: string
}

export interface LitCompareRequest {
  documents: DocumentItem[]
  focus_areas?: string[]
  instructions?: string
}

export interface GapAnalysisRequest {
  documents: DocumentItem[]
  research_area: string
  instructions?: string
}

export interface LiteratureDatabaseOption {
  key: string
  name: string
  description?: string | null
  default_selected: boolean
}

export interface LiteratureDatabaseOptionsResponse {
  databases: LiteratureDatabaseOption[]
  defaults: string[]
}
