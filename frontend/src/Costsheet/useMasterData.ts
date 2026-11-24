import { useState, useCallback } from 'react'
import type { MasterOption, CostCategoryOption, CostStageOption } from './type' // 💡 請依照你原本專案匯入型別的路徑調整

export const useMasterData = () => {
  const [vendorOptions, setVendorOptions] = useState<MasterOption[]>([])
  const [buyerOptions, setBuyerOptions] = useState<MasterOption[]>([])
  const [sections, setSections] = useState<MasterOption[]>([])
  const [categories, setCategories] = useState<CostCategoryOption[]>([])
  const [stages, setStages] = useState<CostStageOption[]>([])

  const refreshMasterData = useCallback(async () => {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/costsheets/masters`)
    if (!response.ok) throw new Error('Could not load source table data.')
    const masters = await response.json()
    setVendorOptions(masters.vendors || [])
    setBuyerOptions(masters.buyers || [])
    setSections(masters.sections || [])
    setCategories(masters.categories || [])
    setStages(masters.stages || [])
  }, [])

  return {
    vendorOptions,
    buyerOptions,
    sections,
    categories,
    stages,
    refreshMasterData
  }
}
