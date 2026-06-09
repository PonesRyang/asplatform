export type GrantStepKey = 'input' | 'keywords' | 'topics' | 'report' | 'proposal'

export interface GrantInputState {
  fundType: string
  researchAreaPath: string[]
  subject: string
  diseasePath: string[]
  phenotype: string
  variableType: string
  variableName: string
}

export interface GrantKeyword {
  id: string
  text: string
  source: 'ai' | 'user' | 'system'
  selected: boolean
  groupKey?: string
}

export interface GrantKeywordGroup {
  key: string
  label: string
  keywords: GrantKeyword[]
}

export interface GrantKeywordState {
  must: GrantKeyword[]
  should: GrantKeyword[]
  groups: GrantKeywordGroup[]
}

export interface GrantReference {
  id: string
  pmid?: string
  doi?: string
  title: string
  journal: string
  year?: number | null
  evidenceNote: string
  selectedForGeneration: boolean
  link?: string
  database?: string
  formatted?: string
}

export interface GrantCandidateTopic {
  id: string
  title: string
  description: string
  innovation: string
  feasibility: string
  fundFit: string
  risk: string
  score: {
    innovation: number
    feasibility: number
    fundFit: number
    evidence: number
  }
  referenceIds: string[]
  selected: boolean
}

export interface GrantReportSection {
  key: string
  title: string
  markdown: string
}

export interface GrantProposalSection {
  key: string
  title: string
  status: 'pending' | 'generating' | 'ready' | 'edited' | 'failed' | 'needs_review'
  markdown: string
  wordCount: number
}

export interface GrantProject {
  id: number
  title: string
  status: 'draft' | 'keywords_ready' | 'references_ready' | 'topics_ready' | 'report_ready' | 'proposal_ready' | 'generating' | 'failed'
  currentStep: GrantStepKey
  input: GrantInputState
  keywords: GrantKeywordState
  references: GrantReference[]
  topics: GrantCandidateTopic[]
  reportSections: GrantReportSection[]
  proposalSections: GrantProposalSection[]
  updatedAt: string
}
