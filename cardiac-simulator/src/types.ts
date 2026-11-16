export type DataMode = 'acquired' | 'inferred' | 'demo'
export type Vec3 = [number, number, number]
export type Crosshair = Vec3
export type Visibility = Record<number, boolean>
export type Plane = 'axial' | 'coronal' | 'sagittal'

export interface AnatomyStructure {
  id: string
  name: string
  color: string
  label: number
}

export interface CaseSummary {
  caseId: string
  title: string
  modality: string
  dataMode: DataMode
  hasOriginalCT: boolean
  completeHeartVerified: boolean
  phaseCount: number
  datasetType: string
}

export interface CaseEntry extends CaseSummary {
  origin: 'api' | 'static'
}

export interface CaseManifest extends CaseSummary {
  referenceBpm: number | null
  phaseTimesNormalized: number[]
  phaseTiming: 'acquisition' | 'uniform-assumed' | 'static'
  structures: AnatomyStructure[]
  coordinateSystem: 'LPS'
  dimensions: Vec3
  voxelSpacingMm: Vec3
  voxelToWorld: number[]
  worldBoundsMm: [Vec3, Vec3]
  assets: {
    volumes: Array<string | null>
    segmentations: Array<string | null>
    meshes: Array<string | null>
  }
  notes: string[]
  source: Record<string, unknown>
}

export interface LoadedCase extends CaseManifest {
  assetRoot: string
}
