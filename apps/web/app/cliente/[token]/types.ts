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
  calendarDraft: boolean
  briefId: string | null
  coverImageFileId: string | null
  scripts: PortalScript[]
  // Brief fields surfaced on the piece when linked
  concept: string | null
  script: string | null
  copyDraft: string | null
  technicalNotes: string | null
  briefFiles: PortalBriefFile[]
  // Content approval (copy/design/concept)
  contentApproval: PortalApproval | null
  // Date approval (proposed publication date)
  dateApproval: PortalApproval | null
  // Kept for backward compat (= contentApproval)
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

export type PortalReelScene = {
  id: string; order: number; duration: string
  visual: string; audio: string; textOverlay: string; music: string
}
export type PortalCarouselSlide = {
  id: string; order: number
  headline: string; body: string; imageDesc: string; cta: string
}
export type PortalScript = {
  id: string
  title: string
  status: string
  type: string
  content: PortalReelScene[] | PortalCarouselSlide[]
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
  scripts: PortalScript[]
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
