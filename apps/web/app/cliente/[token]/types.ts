export type PortalApproval = {
  action: 'approved' | 'changes_requested'
  changeType: string | null
  feedback: string | null
}

export type PortalPiece = {
  id: string
  title: string
  type: 'reel' | 'carrusel' | 'post' | 'story' | 'video'
  platforms: string[]
  status: string
  copy: string | null
  hashtags: string | null
  referencesUrls: string[]
  publicationNotes: string | null
  scheduledDate: string | null
  scheduledTime: string | null
  portalApproval: PortalApproval | null
}

export type PortalBriefFile = {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
  label: string | null
  createdAt: string
}

export type PortalBrief = {
  id: string
  title: string
  type: string
  platforms: string[]
  status: string
  concept: string | null
  script: string | null
  copyDraft: string | null
  hashtags: string | null
  referencesUrls: string[]
  technicalNotes: string | null
  files: PortalBriefFile[]
  portalApproval: PortalApproval | null
}

export type PortalObjective = {
  engagementGoal: string | null
  reachGoal: string | null
  followersGoal: string | null
  leadsGoal: string | null
}

export type PortalStats = {
  mainPieces: number
  mainApproved: number
  mainPending: number
  stories: number
  storiesApproved: number
  storiesPending: number
  totalPending: number
  briefs: number
  briefsPending: number
}

export type PortalHistoryEntry = {
  pieceId: string | null
  briefId: string | null
  action: string
  changeType: string | null
  feedback: string | null
  actionedAt: string
}

export type PortalData = {
  client: { id: string; name: string }
  month: string
  monthLabel: string
  expiresAt: string
  objective: PortalObjective | null
  pieces: PortalPiece[]
  briefs: PortalBrief[]
  history: PortalHistoryEntry[]
  stats: PortalStats
}
