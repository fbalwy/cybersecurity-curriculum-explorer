import source from './plans.generated.json'
import type { PlanDataset, PlanKey, StudyPlan } from './types'

export const dataset = source as PlanDataset

export const plans = dataset.plans

export function getPlan(key: PlanKey): StudyPlan {
  return plans[key]
}

export const planOptions: Array<{ key: PlanKey; label: string; track: string }> = [
  { key: 'developed', label: 'Developed Plan', track: '1446 AH' },
  { key: 'old', label: 'Old Plan', track: '1444 AH' },
]
