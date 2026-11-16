import type { CaseEntry, CaseManifest, CaseSummary, LoadedCase } from '../types'

const apiRoot = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')
const catalogRoot = `${import.meta.env.BASE_URL}cases/`

async function readJSON(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Error ${response.status} al consultar ${url}.`)
  return response.json()
}

function readCatalog(data: unknown): CaseSummary[] {
  const records = Array.isArray(data) ? data : (data as { cases?: unknown } | null)?.cases
  if (!Array.isArray(records) || records.some((record) => !record?.caseId || !record.title)) {
    throw new Error('El catálogo de estudios tiene un formato inválido.')
  }
  return records as CaseSummary[]
}

export async function fetchCaseCatalog(signal?: AbortSignal): Promise<CaseEntry[]> {
  if (apiRoot) {
    try {
      const apiCases = readCatalog(await readJSON(`${apiRoot}/api/cases`, signal))
      if (apiCases.length) return apiCases.map((entry) => ({ ...entry, origin: 'api' }))
    } catch (error) {
      if (signal?.aborted) throw error
    }
  }
  const staticCases = readCatalog(await readJSON(`${catalogRoot}catalog.json`, signal))
  return staticCases.map((entry) => ({ ...entry, origin: 'static' }))
}

export function assertManifest(input: CaseManifest): void {
  if (!input || !input.caseId || !Number.isInteger(input.phaseCount) || input.phaseCount < 1) {
    throw new Error('El estudio debe tener al menos una fase registrada.')
  }
  const validGrid = input.dimensions?.length === 3 && input.dimensions.every((dim) => Number.isInteger(dim) && dim > 0)
  const validSpacing = input.voxelSpacingMm?.length === 3 && input.voxelSpacingMm.every((spacing) => Number.isFinite(spacing) && spacing > 0)
  const validAffine = input.voxelToWorld?.length === 16 && input.voxelToWorld.every(Number.isFinite)
  const validBounds = input.worldBoundsMm?.length === 2 && input.worldBoundsMm.every((point) => point?.length === 3 && point.every(Number.isFinite))
    && input.worldBoundsMm[0].every((value, index) => value <= input.worldBoundsMm[1][index])
  const validTimes = input.phaseTimesNormalized?.length === input.phaseCount
    && input.phaseTimesNormalized.every((phase, index, times) => (
      phase >= 0 && phase < 1 && (index === 0 || phase > times[index - 1])
    ))
  const validAssets = input.assets && [input.assets.meshes, input.assets.volumes, input.assets.segmentations]
    .every((assets) => assets?.length === input.phaseCount && assets.every((asset) => asset === null || typeof asset === 'string'))
  const validStructures = Array.isArray(input.structures) && input.structures.every((structure) => (
    structure?.id && structure.name && /^#[0-9a-f]{6}$/i.test(structure.color)
      && Number.isInteger(structure.label) && structure.label > 0 && structure.label <= 65535
  ))
  if (!validGrid || !validSpacing || !validAffine || !validBounds || !validTimes || !validAssets || !validStructures || input.coordinateSystem !== 'LPS') {
    throw new Error('La geometría o la secuencia temporal del estudio es inválida.')
  }
}

export async function fetchCaseManifest(entry: CaseEntry, signal?: AbortSignal): Promise<LoadedCase> {
  const id = encodeURIComponent(entry.caseId)
  const assetRoot = entry.origin === 'api' ? `${apiRoot}/assets/cases/${id}/` : `${catalogRoot}${id}/`
  const manifestPath = entry.origin === 'api' ? `${apiRoot}/api/cases/${id}/manifest` : `${assetRoot}manifest.json`
  const manifest = await readJSON(manifestPath, signal) as CaseManifest
  assertManifest(manifest)
  if (manifest.caseId !== entry.caseId) throw new Error('El manifiesto corresponde a un estudio diferente.')
  return { ...manifest, assetRoot }
}

export function resolveAsset(assetRoot: string, asset: string): string {
  const base = new URL(assetRoot, window.location.href)
  const target = new URL(asset, base)
  if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) {
    throw new Error('El recurso debe permanecer en el directorio del estudio.')
  }
  return target.href
}
