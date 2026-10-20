import { useEffect, useMemo, useState, type ClipboardEvent } from 'react'

type CostSheetLine = {
  id?: number
  sectionCode: string
  categoryCode: string
  categoryName: string
  itemName: string
  description: string
  articleNumber: string
  supplier: string
  quantity: number
  quantityUnit: string
  unitPrice: number
  priceUnit: string
  calculatedAmount: number
  notes: string
  displayOrder: number
}

type CostSheetHeader = {
  id?: number
  originalCostSheetId?: number
  createdBy?: string
  modifiedBy?: string
  vendor: string
  vendorName?: string
  buyer: string
  buyerName?: string
  season: string
  seasonYear: string
  stage: string
  pdStyle: string
  style: string
  revisionNumber: number
  recordStatus: string
  currency: string
  royaltyRate: number
  notes: string
  createdDate?: string
  modifiedDate?: string
  materialSubtotal?: number
  accessoriesSubtotal?: number
  quotaSubtotal?: number
  cmOverheadSubtotal?: number
  fobPrice?: number
  royaltyAmount?: number
  finalPriceIncludingRoyalty?: number
  lines: CostSheetLine[]
}

type CostSheetSearchResult = {
  id: number
  pdStyle: string
  style: string
  vendor: string
  season: string
  revisionNumber: number
  stage: string
  recordStatus: string
  modifiedDate: string
}

type MasterOption = {
  code: string
  name: string
}

type CostCategoryOption = {
  id: number
  sectionCode: string
  code: string
  name: string
  isActive: boolean
}

type CostStageOption = {
  id: number
  name: string
  isActive: boolean
}

const initialSheet: CostSheetHeader = {
  vendor: 'Pretty',
  buyer: 'DB',
  season: 'Fall',
  seasonYear: '2027',
  stage: '1St PD Sample',
  pdStyle: 'xy4657',
  style: '52XR146',
  revisionNumber: 1,
  recordStatus: 'Draft',
  currency: 'USD',
  royaltyRate: 0.05,
  notes: 'Sample cost sheet',
  lines: [
    { sectionCode: 'A', categoryCode: 'A-1', categoryName: 'Shell', itemName: 'Bodice', description: 'Chiffon', articleNumber: 'SP3449', supplier: 'Supplier 1', quantity: 5, quantityUnit: 'YDS', unitPrice: 1.59, priceUnit: 'YD', calculatedAmount: 7.95, notes: '', displayOrder: 1 },
    { sectionCode: 'A', categoryCode: 'A-3', categoryName: 'Lining', itemName: 'Skirt', description: 'Lining', articleNumber: 'GT207', supplier: 'Supplier 1', quantity: 8, quantityUnit: 'YDS', unitPrice: 0.83, priceUnit: 'YD', calculatedAmount: 6.64, notes: '', displayOrder: 2 },
    { sectionCode: 'B', categoryCode: 'Zipper', categoryName: 'Zipper', itemName: 'Zipper', description: '14\' zipper', articleNumber: 'ZP-14', supplier: 'Supplier 2', quantity: 1, quantityUnit: 'PCS', unitPrice: 1, priceUnit: 'PC', calculatedAmount: 1, notes: '', displayOrder: 3 },
    { sectionCode: 'D', categoryCode: 'Gown CM + Overhead', categoryName: 'CM & Overhead', itemName: 'Gown CM + Overhead', description: 'Labor, finance, transportation, profit', articleNumber: 'CM-1', supplier: 'Production', quantity: 1, quantityUnit: 'PCS', unitPrice: 27.69, priceUnit: 'PC', calculatedAmount: 27.69, notes: '', displayOrder: 4 },
  ]
}


const costSheetStatuses = ['Draft', 'Submitted', 'Approved', 'Archive']
const createEmptySheet = (): CostSheetHeader => ({
  vendor: '',
  buyer: '',
  season: '',
  seasonYear: '',
  stage: '',
  pdStyle: '',
  style: '',
  revisionNumber: 1,
  recordStatus: 'Draft',
  currency: '',
  royaltyRate: 0,
  notes: '',
  lines: []
})

function calculateLineAmount(quantity: number, unitPrice: number) {
  const q = Number.isFinite(quantity) ? quantity : 0
  const p = Number.isFinite(unitPrice) ? unitPrice : 0
  return Math.max(0, q * p)
}

function parseNumericCell(value: string) {
  const normalized = value.replace(/,/g, '').replace(/[^0-9.-]/g, '')
  return Number(normalized) || 0
}

function isCurrencyCell(value: string) {
  return /^(US\$|USD|EUR|GBP|CNY|\$|€|£)\s*$/i.test(value.trim())
}

function isFormattedPriceCell(value: string) {
  return /^(?:(?:US\$|USD|EUR|GBP|CNY|\$|€|£)\s*)?\(?-?\d+(?:[.,]\d+)?(?:\s+.+)?\)?\s*$/i.test(value.trim())
}

function App() {
  const [isLoggedIn, setLoggedIn] = useState(false)
  const [isEditorOpen, setEditorOpen] = useState(false)
  const [isSearchOpen, setSearchOpen] = useState(false)
  const [isMaintenanceOpen, setMaintenanceOpen] = useState(false)
  const [maintenanceTab, setMaintenanceTab] = useState<'category' | 'stage'>('category')
  const [loginName, setLoginName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('')
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [vendorOptions, setVendorOptions] = useState<MasterOption[]>([])
  const [buyerOptions, setBuyerOptions] = useState<MasterOption[]>([])
  const [sections, setSections] = useState<MasterOption[]>([])
  const [categories, setCategories] = useState<CostCategoryOption[]>([])
  const [stages, setStages] = useState<CostStageOption[]>([])
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editingStageId, setEditingStageId] = useState<number | null>(null)
  const [categoryDraft, setCategoryDraft] = useState({ sectionCode: '', code: '', name: '' })
  const [stageDraft, setStageDraft] = useState('')
  const [searchCriteria, setSearchCriteria] = useState({ pdStyle: '', style: '', season: '', stage: '', recordStatus: '', vendor: '' })
  const [searchResults, setSearchResults] = useState<CostSheetSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [sheet, setSheet] = useState<CostSheetHeader>(initialSheet)
  const [printSheet, setPrintSheet] = useState<CostSheetHeader | null>(null)
  const [message, setMessage] = useState('')
  const [activeCell, setActiveCell] = useState({ row: 0, column: 0 })

  const refreshMasterData = async () => {
    const response = await fetch('/api/costsheets/masters')
    if (!response.ok) throw new Error('Could not load source table data.')
    const masters = await response.json()
    setVendorOptions(masters.vendors || [])
    setBuyerOptions(masters.buyers || [])
    setSections(masters.sections || [])
    setCategories(masters.categories || [])
    setStages(masters.stages || [])
  }

  useEffect(() => {
    if (!printSheet) return

    const finishPrint = () => {
      setPrintSheet(null)
      setPrinting(false)
    }
    window.addEventListener('afterprint', finishPrint, { once: true })
    const frame = requestAnimationFrame(() => window.print())

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('afterprint', finishPrint)
    }
  }, [printSheet])

  const totals = useMemo(() => {
    const material = sheet.lines
      .filter((line) => line.sectionCode === 'A')
      .reduce((sum, line) => sum + calculateLineAmount(line.quantity, line.unitPrice), 0)
    const accessories = sheet.lines
      .filter((line) => line.sectionCode === 'B')
      .reduce((sum, line) => sum + calculateLineAmount(line.quantity, line.unitPrice), 0)
    const quota = sheet.lines
      .filter((line) => line.sectionCode === 'C')
      .reduce((sum, line) => sum + calculateLineAmount(line.quantity, line.unitPrice), 0)
    const cm = sheet.lines
      .filter((line) => line.sectionCode === 'D')
      .reduce((sum, line) => sum + calculateLineAmount(line.quantity, line.unitPrice), 0)
    const fob = material + accessories + quota + cm
    const royalty = fob * sheet.royaltyRate
    const finalPrice = fob + royalty

    return { material, accessories, quota, cm, fob, royalty, finalPrice }
  }, [sheet.lines, sheet.royaltyRate])

  const login = async () => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginName, password })
      })

      if (!response.ok) {
        if (response.status === 401) {
          setMessage('Invalid username or password.')
        } else {
          const error = await response.json().catch(() => null)
          setMessage(error?.detail || error?.message || 'Login service is unavailable.')
        }
        return
      }

      const result = await response.json()
      if (!result.isValid) {
        setMessage('Invalid username or password.')
        return
      }
      const resolvedUsername = result.fullName || result.username || result.loginName || loginName
      setUsername(resolvedUsername)
      setLoginName(result.loginName || loginName)
      setRole(result.role || '')
      setIsAuthorized(Boolean(result.isAuthorized))
      await refreshMasterData()
      setLoggedIn(true)
      setMessage(`Logged in as ${resolvedUsername}.`)
    } catch {
      setMessage('Backend is not running. Start the API first.')
    }
  }

  const isAuthorizedUser = isAuthorized

  const openMaintenance = async () => {
    setMessage('')
    setMaintenanceOpen(true)
    try {
      await refreshMasterData()
    } catch {
      setMessage('Source table data could not be loaded.')
    }
  }

  const saveCategory = async () => {
    const isEditing = editingCategoryId !== null
    const response = await fetch(isEditing ? `/api/maintenance/categories/${editingCategoryId}` : '/api/maintenance/categories', {
      method: isEditing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categoryDraft)
    })
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      setMessage(error?.message || 'Category could not be saved.')
      return
    }
    setCategoryDraft({ sectionCode: '', code: '', name: '' })
    setEditingCategoryId(null)
    await refreshMasterData()
    setMessage('Category saved.')
  }

  const saveStage = async () => {
    const isEditing = editingStageId !== null
    const response = await fetch(isEditing ? `/api/maintenance/stages/${editingStageId}` : '/api/maintenance/stages', {
      method: isEditing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: stageDraft, isActive: true })
    })
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      setMessage(error?.message || 'Stage could not be saved.')
      return
    }
    setStageDraft('')
    setEditingStageId(null)
    await refreshMasterData()
    setMessage('Stage saved.')
  }

  const setCategoryActive = async (category: CostCategoryOption, isActive: boolean) => {
    const response = await fetch(`/api/maintenance/categories/${category.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionCode: category.sectionCode, code: category.code, name: category.name, isActive })
    })
    if (response.ok) await refreshMasterData()
  }

  const setStageActive = async (stage: CostStageOption, isActive: boolean) => {
    const response = await fetch(`/api/maintenance/stages/${stage.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: stage.name, isActive })
    })
    if (response.ok) await refreshMasterData()
  }

  const openSearch = () => {
    setSearchCriteria((current) => ({ ...current, vendor: isAuthorizedUser ? '' : loginName }))
    setSearchResults([])
    setSearchOpen(true)
  }

  const searchCostSheets = async () => {
    setSearching(true)
    try {
      const query = new URLSearchParams()
      Object.entries(searchCriteria).forEach(([key, value]) => {
        if (value.trim()) query.set(key, value.trim())
      })
      if (!isAuthorizedUser) query.set('vendor', loginName)
      const response = await fetch(`/api/costsheets/search?${query.toString()}`)
      if (!response.ok) {
        setMessage('Cost sheet search failed.')
        return
      }
      setSearchResults(await response.json())
    } catch {
      setMessage('Cost sheet search request failed.')
    } finally {
      setSearching(false)
    }
  }

  const loadCostSheet = async (id: number, asCopy = false) => {
    try {
      const response = await fetch(`/api/costsheets/${id}`)
      if (!response.ok) {
        setMessage('The selected cost sheet could not be loaded.')
        return
      }

      const loaded = await response.json() as CostSheetHeader
      setSheet(asCopy ? {
        ...loaded,
        id: undefined,
        originalCostSheetId: loaded.id,
        recordStatus: 'Draft',
        lines: loaded.lines.map((line) => {
          const copiedLine = { ...line }
          delete copiedLine.id
          return copiedLine
        })
      } : loaded)
      setSearchOpen(false)
      setEditorOpen(true)
      setMessage('')
    } catch {
      setMessage('Cost sheet load request failed.')
    }
  }

  const printSavedSheet = async (id: number) => {
    setPrinting(true)
    try {
      const response = await fetch(`/api/costsheets/${id}/print`)
      if (!response.ok) {
        setMessage('The saved cost sheet could not be loaded for printing.')
        setPrinting(false)
        return
      }

      setPrintSheet(await response.json())
    } catch {
      setMessage('Cost sheet print request failed.')
      setPrinting(false)
    }
  }

  const saveSheet = async () => {
    setSaving(true)
    try {
      const isEditing = (sheet.id ?? 0) > 0
      const response = await fetch(isEditing ? `/api/costsheets/${sheet.id}` : '/api/costsheets', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sheet, createdBy: loginName, modifiedBy: loginName })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        const validationMessages = Object.values(error?.errors ?? {}).flat().join(' ')
        setMessage(validationMessages || error?.detail || error?.message || 'The cost sheet could not be saved.')
        return
      }

      const saved = await response.json()
      setSheet((current) => ({ ...current, id: saved.id, revisionNumber: saved.revisionNumber, originalCostSheetId: undefined }))
      setMessage('Cost sheet saved successfully.')
    } catch {
      setMessage('Cost sheet save request failed.')
    } finally {
      setSaving(false)
    }
  }

  const calculateNow = async () => {
    try {
      const response = await fetch('/api/costsheets/recalc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sheet, lines: sheet.lines.map((line) => ({ ...line, calculatedAmount: calculateLineAmount(line.quantity, line.unitPrice) })) })
      })

      if (!response.ok) {
        setMessage('Calculation validation failed.')
        return
      }

      const updated = await response.json()
      setSheet(updated)
      setMessage('Calculations updated successfully.')
    } catch {
      setMessage('Calculation request failed.')
    }
  }

  const updateLine = <K extends keyof CostSheetLine>(index: number, field: K, value: CostSheetLine[K], fallbackSectionCode?: string) => {
    setSheet((previous) => ({
      ...previous,
      lines: index < 0
        ? [...previous.lines, {
          sectionCode: fallbackSectionCode || 'A', categoryCode: '', categoryName: '', itemName: '', description: '',
          articleNumber: '', supplier: '', quantity: 0, quantityUnit: 'PCS', unitPrice: 0, priceUnit: 'PC',
          calculatedAmount: 0, notes: '', displayOrder: previous.lines.length + 1, [field]: value
        }]
        : previous.lines.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line)
    }))
  }

  const addLine = (sectionCode: string) => {
    setSheet((previous) => {
      const newLine: CostSheetLine = {
        sectionCode,
        categoryCode: '',
        categoryName: '',
        itemName: '',
        description: '',
        articleNumber: '',
        supplier: '',
        quantity: 0,
        quantityUnit: 'PCS',
        unitPrice: 0,
        priceUnit: 'PC',
        calculatedAmount: 0,
        notes: '',
        displayOrder: previous.lines.length + 1
      }
      const firstSectionRow = previous.lines.findIndex((line) => line.sectionCode === sectionCode)
      const insertAt = firstSectionRow >= 0 ? firstSectionRow : previous.lines.length
      const lines = [...previous.lines]
      lines.splice(insertAt, 0, newLine)
      return { ...previous, lines }
    })
    setMessage(`New ${sectionCode} row added.`)
  }

  const removeLine = (index: number) => {
    setSheet((previous) => ({
      ...previous,
      lines: previous.lines
        .filter((_, lineIndex) => lineIndex !== index)
        .map((line, lineIndex) => ({ ...line, displayOrder: lineIndex + 1 }))
    }))
    setMessage('Transaction row removed. Save Changes to apply it to the saved record.')
  }

  const gridFields: Array<keyof CostSheetLine | null> = [
    'sectionCode', 'categoryCode', 'categoryName', 'itemName', 'description', 'articleNumber',
    'supplier', 'quantity', 'quantityUnit', null, 'unitPrice', null, null
  ]

  const pasteIntoGrid = (event: ClipboardEvent<HTMLTableElement>, rowIndexes?: number[], defaultSectionCode = 'A') => {
    const pasted = event.clipboardData.getData('text/plain')
    const target = event.target as HTMLElement
    const targetRow = Number(target.dataset.gridRow)
    const targetColumn = Number(target.dataset.gridColumn)
    const pasteOrigin = Number.isFinite(targetRow) && Number.isFinite(targetColumn)
      ? { row: targetRow, column: targetColumn }
      : activeCell
    const isRange = pasted.includes('\t') || pasted.includes('\n')
    if (!isRange) {
      const field = gridFields[pasteOrigin.column]
      if (field !== 'quantity' && field !== 'unitPrice') return
      event.preventDefault()
      setSheet((previous) => ({
        ...previous,
        lines: previous.lines.map((line, lineIndex) => {
          if (lineIndex !== pasteOrigin.row) return line
          const value = parseNumericCell(pasted)
          return {
            ...line,
            [field]: value,
            calculatedAmount: calculateLineAmount(field === 'quantity' ? value : line.quantity, field === 'unitPrice' ? value : line.unitPrice)
          }
        })
      }))
      setMessage(`Pasted ${field === 'unitPrice' ? 'Unit Price' : 'Consumption'} value.`)
      return
    }

    event.preventDefault()
    const rows = pasted.replace(/\r/g, '').split('\n').filter((row) => row.length > 0).map((row) => row.split('\t'))
    setSheet((previous) => {
      const lines = [...previous.lines]
      const startRow = rowIndexes ? Math.max(0, rowIndexes.indexOf(pasteOrigin.row)) : pasteOrigin.row
      rows.forEach((values, rowOffset) => {
        let lineIndex = rowIndexes ? rowIndexes[startRow + rowOffset] : pasteOrigin.row + rowOffset
        if (lineIndex === undefined || !lines[lineIndex]) {
          lineIndex = lines.length
          lines.push({
            sectionCode: defaultSectionCode, categoryCode: '', categoryName: '', itemName: '', description: '',
            articleNumber: '', supplier: '', quantity: 0, quantityUnit: 'PCS', unitPrice: 0, priceUnit: 'PC',
            calculatedAmount: 0, notes: '', displayOrder: lines.length + 1
          })
        }
        const line = { ...lines[lineIndex] }
        values.forEach((value, columnOffset) => {
          const field = gridFields[pasteOrigin.column + columnOffset]
          if (!field) return
          if (field === 'quantity' || field === 'unitPrice') {
            line[field] = parseNumericCell(value)
          } else {
            line[field] = value.trim() as never
          }
        })

        const currencyIndex = values.findIndex(isCurrencyCell)
        const expectedPriceIndex = 10 - pasteOrigin.column
        const priceIndex = values[expectedPriceIndex] && isFormattedPriceCell(values[expectedPriceIndex])
          ? expectedPriceIndex
          : currencyIndex >= 0
            ? values.findIndex((value, index) => index > currencyIndex && isFormattedPriceCell(value))
            : values.findLastIndex(isFormattedPriceCell)
        if (priceIndex >= 0) {
          const priceCell = values[priceIndex].trim()
          line.unitPrice = parseNumericCell(priceCell)
          const priceUnitMatch = priceCell.match(/[-+]?\d+(?:[.,]\d+)?\s+(.+?)(?:\)|\s*)$/)
          if (priceUnitMatch) {
            line.priceUnit = priceUnitMatch[1].trim()
          } else if (values[priceIndex + 1] && !isCurrencyCell(values[priceIndex + 1]) && parseNumericCell(values[priceIndex + 1]) === 0) {
            line.priceUnit = values[priceIndex + 1].trim()
          }
          const consumptionIndex = values
            .map((value, index) => ({ value, index }))
            .slice(0, currencyIndex)
            .reverse()
            .find(({ value }) => /^\s*-?\d+(?:[.,]\d+)?\s*$/.test(value))?.index
          if (consumptionIndex !== undefined) {
            line.quantity = parseNumericCell(values[consumptionIndex])
            if (values[consumptionIndex + 1]) {
              line.quantityUnit = values[consumptionIndex + 1].trim()
            }
          }
        }
        line.calculatedAmount = calculateLineAmount(line.quantity, line.unitPrice)
        lines[lineIndex] = line
      })
      return { ...previous, lines }
    })
    setMessage(`Pasted ${rows.length} row${rows.length === 1 ? '' : 's'} into the costing grid.`)
  }

  const renderCostGrid = (title: string, sectionCodes: string[]) => {
    const gridLines = sheet.lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => sectionCodes.includes(line.sectionCode))

    const visibleLines = gridLines.length > 0 ? gridLines : [{
      index: -1,
      line: {
        sectionCode: sectionCodes[0],
        categoryCode: '',
        categoryName: '',
        itemName: '',
        description: '',
        articleNumber: '',
        supplier: '',
        quantity: 0,
        quantityUnit: 'PCS',
        unitPrice: 0,
        priceUnit: 'PC',
        calculatedAmount: 0,
        notes: '',
        displayOrder: sheet.lines.length + 1
      }
    }]
    const updateGridLine = <K extends keyof CostSheetLine>(index: number, field: K, value: CostSheetLine[K]) => updateLine(index, field, value, sectionCodes[0])

    return (
      <section className="panel grid-panel" key={title}>
        <div className="panel-header grid-panel-header"><span>{title} <small className="row-count">{gridLines.length} row{gridLines.length === 1 ? '' : 's'}</small></span><button type="button" className="add-row-btn" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); addLine(sectionCodes[0]) }}>+ Add Row</button></div>
        <div className="table-scroll">
          <table className="cost-grid" onPaste={(event) => pasteIntoGrid(event, gridLines.map(({ index }) => index), sectionCodes[0])}>
            <thead>
              <tr>
                <th rowSpan={2}>Section</th>
                <th rowSpan={2}>Sub-Section</th>
                <th rowSpan={2}>Category</th>
                <th rowSpan={2}>Item</th>
                <th rowSpan={2}>Description</th>
                <th rowSpan={2}>Article No</th>
                <th rowSpan={2}>Supplier</th>
                <th colSpan={2}>Consumption</th>
                <th colSpan={2}>Unit Price</th>
                <th>Amount</th>
                <th rowSpan={2}>Action</th>
              </tr>
              <tr>
                <th>Value</th>
                <th>Unit</th>
                <th>Currency</th>
                <th>Unit Price</th>
                <th>Calculated</th>
              </tr>
            </thead>
            <tbody>
              {visibleLines.map(({ line, index }) => (
                <tr className="cost-row" key={`${line.sectionCode}-${line.categoryCode}-${index}`}>
                  <td onMouseDown={() => setActiveCell({ row: index, column: 0 })}><input data-grid-row={index} data-grid-column={0} value={line.sectionCode} onFocus={() => setActiveCell({ row: index, column: 0 })} onChange={(e) => updateGridLine(index, 'sectionCode', e.target.value)} /></td>
                  <td onMouseDown={() => setActiveCell({ row: index, column: 1 })}><input data-grid-row={index} data-grid-column={1} value={line.categoryCode} onFocus={() => setActiveCell({ row: index, column: 1 })} onChange={(e) => updateGridLine(index, 'categoryCode', e.target.value)} /></td>
                  <td onMouseDown={() => setActiveCell({ row: index, column: 2 })}><input data-grid-row={index} data-grid-column={2} value={line.categoryName} onFocus={() => setActiveCell({ row: index, column: 2 })} onChange={(e) => updateGridLine(index, 'categoryName', e.target.value)} /></td>
                  <td onMouseDown={() => setActiveCell({ row: index, column: 3 })}><input data-grid-row={index} data-grid-column={3} value={line.itemName} onFocus={() => setActiveCell({ row: index, column: 3 })} onChange={(e) => updateGridLine(index, 'itemName', e.target.value)} /></td>
                  <td onMouseDown={() => setActiveCell({ row: index, column: 4 })}><input data-grid-row={index} data-grid-column={4} value={line.description} onFocus={() => setActiveCell({ row: index, column: 4 })} onChange={(e) => updateGridLine(index, 'description', e.target.value)} /></td>
                  <td onMouseDown={() => setActiveCell({ row: index, column: 5 })}><input data-grid-row={index} data-grid-column={5} value={line.articleNumber} onFocus={() => setActiveCell({ row: index, column: 5 })} onChange={(e) => updateGridLine(index, 'articleNumber', e.target.value)} /></td>
                  <td onMouseDown={() => setActiveCell({ row: index, column: 6 })}><input data-grid-row={index} data-grid-column={6} value={line.supplier} onFocus={() => setActiveCell({ row: index, column: 6 })} onChange={(e) => updateGridLine(index, 'supplier', e.target.value)} /></td>
                  <td onMouseDown={() => setActiveCell({ row: index, column: 7 })}><input data-grid-row={index} data-grid-column={7} className="amount-input" value={line.quantity} onFocus={() => setActiveCell({ row: index, column: 7 })} onChange={(e) => updateGridLine(index, 'quantity', Number(e.target.value || 0))} /></td>
                  <td onMouseDown={() => setActiveCell({ row: index, column: 8 })}><input data-grid-row={index} data-grid-column={8} value={line.quantityUnit} onFocus={() => setActiveCell({ row: index, column: 8 })} onChange={(e) => updateGridLine(index, 'quantityUnit', e.target.value)} /></td>
                  <td onMouseDown={() => setActiveCell({ row: index, column: 9 })}><input data-grid-row={index} data-grid-column={9} className="display-input currency-cell" readOnly value={sheet.currency} onFocus={() => setActiveCell({ row: index, column: 9 })} /></td>
                  <td onMouseDown={() => setActiveCell({ row: index, column: 10 })}><input data-grid-row={index} data-grid-column={10} className="amount-input" value={line.unitPrice} onFocus={() => setActiveCell({ row: index, column: 10 })} onChange={(e) => updateGridLine(index, 'unitPrice', parseNumericCell(e.target.value))} /></td>
                  <td className="numeric" onMouseDown={() => setActiveCell({ row: index, column: 11 })}><input data-grid-row={index} data-grid-column={11} className="display-input numeric" readOnly value={calculateLineAmount(line.quantity, line.unitPrice).toFixed(2)} onFocus={() => setActiveCell({ row: index, column: 11 })} /></td>
                  <td>{index >= 0 && <button type="button" className="remove-btn" onClick={() => removeLine(index)}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-brand">Garment Costing</div>
          <div className="login-subtitle">Enterprise Cost Sheet</div>
          <div className="field-group">
            <label>Username</label>
            <input value={loginName} onChange={(event) => setLoginName(event.target.value)} />
          </div>
          <div className="field-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {message && <div className="alert-box">{message}</div>}
          <button className="primary-btn" onClick={login}>Submit</button>
        </div>
      </div>
    )
  }

  return (
    <div className="costsheet-shell">
      <header className="top-toolbar">
        <div className="toolbar-left">
          <div className="app-title">Garment Costing</div>
          <button className="toolbar-btn primary" onClick={() => { setSheet(createEmptySheet()); setEditorOpen(true) }}>New Cost Sheet</button>
          <button className="toolbar-btn" onClick={openSearch}>Search Cost Sheet</button>
          <button className="toolbar-btn" onClick={openMaintenance}>Source Table Maintenance</button>
        </div>
        <div className="toolbar-right">
          <span className="user-badge">{username} · {role}</span>
          <button className="toolbar-btn ghost" onClick={() => setLoggedIn(false)}>Logout</button>
        </div>
      </header>

      <main className="workspace summary-workspace">
        <section className="panel summary-panel master-summary-panel">
          <div className="summary-heading">
            <div>
              <div className="eyebrow">Cost Sheet Records</div>
              <h1>Master</h1>
              <p>PD design master information.</p>
            </div>
            <button className="primary-btn" onClick={() => { setSheet((current) => ({ ...current, id: undefined, originalCostSheetId: current.id ?? current.originalCostSheetId, pdStyle: '', style: '', season: '', seasonYear: '', stage: '', recordStatus: 'Draft', revisionNumber: 1, currency: 'USD', buyer: 'DB', lines: [] })); setEditorOpen(true) }}>+ New Record</button>
          </div>
          <div className="summary-meta">
            <div><span>PD Style</span><strong>{sheet.pdStyle}</strong></div>
            <div><span>Style</span><strong>{sheet.style}</strong></div>
            <div><span>Buyer</span><strong>{sheet.buyer}</strong></div>
            <div><span>Record Status</span><strong className="status-pill">{sheet.recordStatus}</strong></div>
            <div><span>Vendor</span><strong>{sheet.vendor}</strong></div>
            <div><span>Season</span><strong>{sheet.season} {sheet.seasonYear}</strong></div>
            <div><span>Stage</span><strong>{sheet.stage}</strong></div>
            <div><span>Currency</span><strong>{sheet.currency}</strong></div>
          </div>
        </section>

        <section className="panel transaction-summary-panel">
          <div className="panel-header">Transaction</div>
          <div className="transaction-caption">Transactions for {sheet.pdStyle} / {sheet.style}</div>
          <div className="record-table-wrap">
            <table className="record-table">
              <thead>
                <tr>
                  <th>Revision</th>
                  <th>Stage</th>
                  <th>Record Status</th>
                  <th>Modified Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(sheet.id || sheet.lines.length > 0) && <tr>
                  <td>{sheet.revisionNumber}</td>
                  <td>{sheet.stage}</td>
                  <td><span className="status-pill">{sheet.recordStatus}</span></td>
                  <td>2026-09-24</td>
                  <td>
                    <button className="edit-btn" onClick={() => setEditorOpen(true)}>Edit</button>
                    <button className="edit-btn" onClick={() => {
                      setSheet((current) => ({
                        ...current,
                        id: undefined,
                        originalCostSheetId: current.id ?? current.originalCostSheetId,
                        recordStatus: 'Draft',
                        lines: current.lines.map((line) => {
                          const copiedLine = { ...line }
                          delete copiedLine.id
                          return copiedLine
                        })
                      }))
                      setEditorOpen(true)
                    }}>Copy</button>
                  </td>
                </tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {isSearchOpen && <div className="modal-backdrop search-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false) }}>
        <section className="search-modal" role="dialog" aria-modal="true" aria-labelledby="search-title">
          <div className="modal-header">
            <div>
              <div className="eyebrow">Cost Sheet Records</div>
              <h2 id="search-title">Search Cost Sheets</h2>
            </div>
            <button className="close-btn" onClick={() => setSearchOpen(false)} aria-label="Close search">×</button>
          </div>
          <div className="search-body">
            <div className="search-fields">
              <div className="field-group compact"><label>PD Style</label><input value={searchCriteria.pdStyle} onChange={(event) => setSearchCriteria({ ...searchCriteria, pdStyle: event.target.value })} /></div>
              <div className="field-group compact"><label>Style</label><input value={searchCriteria.style} onChange={(event) => setSearchCriteria({ ...searchCriteria, style: event.target.value })} /></div>
              <div className="field-group compact"><label>Season</label><input placeholder="e.g. Fall 2027" value={searchCriteria.season} onChange={(event) => setSearchCriteria({ ...searchCriteria, season: event.target.value })} /></div>
              <div className="field-group compact"><label>Stage</label><select value={searchCriteria.stage} onChange={(event) => setSearchCriteria({ ...searchCriteria, stage: event.target.value })}><option value="">All stages</option>{stages.filter((stage) => stage.isActive).map((stage) => <option key={stage.id} value={stage.name}>{stage.name}</option>)}</select></div>
              <div className="field-group compact"><label>Record Status</label><select value={searchCriteria.recordStatus} onChange={(event) => setSearchCriteria({ ...searchCriteria, recordStatus: event.target.value })}><option value="">All status</option>{costSheetStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
              <div className="field-group compact"><label>Vendor</label>{isAuthorizedUser
                ? <select value={searchCriteria.vendor} onChange={(event) => setSearchCriteria({ ...searchCriteria, vendor: event.target.value })}><option value="">All vendors</option>{vendorOptions.map((vendor) => <option key={vendor.code} value={vendor.code}>{vendor.name}</option>)}</select>
                : <input value={loginName} readOnly aria-readonly="true" />}</div>
            </div>
            <div className="search-actions"><button className="primary-btn" onClick={searchCostSheets} disabled={searching}>{searching ? 'Searching...' : 'Search'}</button><button className="secondary-btn" onClick={() => { setSearchCriteria({ pdStyle: '', style: '', season: '', stage: '', recordStatus: '', vendor: isAuthorizedUser ? '' : loginName }); setSearchResults([]) }}>Clear</button></div>
            <div className="search-results-wrap">
              <table className="record-table search-results">
                <thead><tr><th>PD Style</th><th>Style</th><th>Vendor</th><th>Season</th><th>Revision</th><th>Stage</th><th>Record Status</th><th>Modified Date</th><th>Action</th></tr></thead>
                <tbody>{searchResults.map((result) => <tr key={result.id}><td className="strong-cell">{result.pdStyle}</td><td>{result.style}</td><td>{result.vendor}</td><td>{result.season}</td><td>{result.revisionNumber}</td><td>{result.stage}</td><td>{result.recordStatus}</td><td>{result.modifiedDate ? new Date(result.modifiedDate).toLocaleDateString() : ''}</td><td><button className="edit-btn" onClick={() => loadCostSheet(result.id)}>Select</button></td></tr>)}
                  {searchResults.length === 0 && <tr><td className="empty-results" colSpan={9}>Enter search criteria and select Search.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>}

      {isMaintenanceOpen && <div className="modal-backdrop search-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMaintenanceOpen(false) }}>
        <section className="search-modal maintenance-modal" role="dialog" aria-modal="true" aria-labelledby="maintenance-title">
          <div className="modal-header">
            <div>
              <div className="eyebrow">Source Tables</div>
              <h2 id="maintenance-title">Source Table Maintenance</h2>
            </div>
            <button className="close-btn" onClick={() => setMaintenanceOpen(false)} aria-label="Close source maintenance">×</button>
          </div>
          <div className="search-body">
            <div className="maintenance-tabs" role="tablist" aria-label="Source table type">
              <button type="button" className={maintenanceTab === 'category' ? 'primary-btn' : 'secondary-btn'} onClick={() => setMaintenanceTab('category')}>Categories</button>
              <button type="button" className={maintenanceTab === 'stage' ? 'primary-btn' : 'secondary-btn'} onClick={() => setMaintenanceTab('stage')}>Stages</button>
            </div>
            {maintenanceTab === 'category' ? <>
              <div className="maintenance-form">
                <div className="field-group compact"><label>Section</label><select value={categoryDraft.sectionCode} onChange={(event) => setCategoryDraft({ ...categoryDraft, sectionCode: event.target.value })}><option value="">Select section</option>{sections.map((section) => <option key={section.code} value={section.code}>{section.code} · {section.name}</option>)}</select></div>
                <div className="field-group compact"><label>Category Code</label><input value={categoryDraft.code} onChange={(event) => setCategoryDraft({ ...categoryDraft, code: event.target.value })} /></div>
                <div className="field-group compact"><label>Category Name</label><input value={categoryDraft.name} onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })} /></div>
                <div className="maintenance-form-actions"><button type="button" className="primary-btn" onClick={saveCategory}>{editingCategoryId === null ? 'Add Category' : 'Save Category'}</button>{editingCategoryId !== null && <button type="button" className="secondary-btn" onClick={() => { setEditingCategoryId(null); setCategoryDraft({ sectionCode: '', code: '', name: '' }) }}>Cancel</button>}</div>
              </div>
              <div className="search-results-wrap maintenance-table-wrap"><table className="record-table"><thead><tr><th>Section</th><th>Category Code</th><th>Category Name</th><th>Status</th><th>Actions</th></tr></thead><tbody>
                {categories.map((category) => <tr key={category.id}><td>{category.sectionCode}</td><td>{category.code}</td><td>{category.name}</td><td>{category.isActive ? 'Active' : 'Inactive'}</td><td><button type="button" className="edit-btn" onClick={() => { setEditingCategoryId(category.id); setCategoryDraft({ sectionCode: category.sectionCode, code: category.code, name: category.name }) }}>Edit</button><button type="button" className="edit-btn" onClick={() => setCategoryActive(category, !category.isActive)}>{category.isActive ? 'Deactivate' : 'Activate'}</button></td></tr>)}
                {categories.length === 0 && <tr><td className="empty-results" colSpan={5}>No categories are defined.</td></tr>}
              </tbody></table></div>
            </> : <>
              <div className="maintenance-form stage-maintenance-form">
                <div className="field-group compact"><label>Stage Name</label><input value={stageDraft} onChange={(event) => setStageDraft(event.target.value)} /></div>
                <div className="maintenance-form-actions"><button type="button" className="primary-btn" onClick={saveStage}>{editingStageId === null ? 'Add Stage' : 'Save Stage'}</button>{editingStageId !== null && <button type="button" className="secondary-btn" onClick={() => { setEditingStageId(null); setStageDraft('') }}>Cancel</button>}</div>
              </div>
              <div className="search-results-wrap maintenance-table-wrap"><table className="record-table"><thead><tr><th>Stage</th><th>Status</th><th>Actions</th></tr></thead><tbody>
                {stages.map((stage) => <tr key={stage.id}><td>{stage.name}</td><td>{stage.isActive ? 'Active' : 'Inactive'}</td><td><button type="button" className="edit-btn" onClick={() => { setEditingStageId(stage.id); setStageDraft(stage.name) }}>Edit</button><button type="button" className="edit-btn" onClick={() => setStageActive(stage, !stage.isActive)}>{stage.isActive ? 'Deactivate' : 'Activate'}</button></td></tr>)}
                {stages.length === 0 && <tr><td className="empty-results" colSpan={3}>No stages are defined.</td></tr>}
              </tbody></table></div>
            </>}
            {message && <div className="modal-message">{message}</div>}
          </div>
        </section>
      </div>}

      {isEditorOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false) }}>
        <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
          <div className="modal-header">
            <div>
              <div className="eyebrow">Transaction Editor</div>
              <h2 id="editor-title">{sheet.pdStyle} / {sheet.style}</h2>
            </div>
            <button className="close-btn" onClick={() => setEditorOpen(false)} aria-label="Close editor">×</button>
          </div>
          <div className="modal-body">
            <section className="panel form-panel">
          <div className="panel-header">Header Information</div>
          <div className="header-grid">
            <div className="field-group compact"><label>PD Style</label><input value={sheet.pdStyle} onChange={(e) => setSheet({ ...sheet, pdStyle: e.target.value })} /></div>
            <div className="field-group compact"><label>Style</label><input value={sheet.style} onChange={(e) => setSheet({ ...sheet, style: e.target.value })} /></div>
            <div className="field-group compact season-field"><label>Season</label><div className="season-controls"><select value={sheet.season} onChange={(e) => setSheet({ ...sheet, season: e.target.value })}><option value=""></option><option>Spring</option><option>Summer</option><option>Fall</option><option>Winter</option></select><select aria-label="Season Year" value={sheet.seasonYear} onChange={(e) => setSheet({ ...sheet, seasonYear: e.target.value })}><option value=""></option><option>2026</option><option>2027</option><option>2028</option></select></div></div>
            <div className="field-group compact"><label>Stage</label><select value={sheet.stage} onChange={(e) => setSheet({ ...sheet, stage: e.target.value })}><option value=""></option>{stages.filter((stage) => stage.isActive).map((stage) => <option key={stage.id} value={stage.name}>{stage.name}</option>)}</select></div>
            <div className="field-group compact"><label>Record Status</label><select required value={sheet.recordStatus} onChange={(e) => setSheet({ ...sheet, recordStatus: e.target.value })}>{costSheetStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
            <div className="field-group compact"><label>Vendor</label><select required value={sheet.vendor} onChange={(e) => setSheet({ ...sheet, vendor: e.target.value })}><option value="">Select vendor</option>{sheet.vendor && !vendorOptions.some((option) => option.code === sheet.vendor) && <option value={sheet.vendor}>{sheet.vendor}</option>}{vendorOptions.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}</select></div>
            <div className="field-group compact"><label>Buyer</label><select required value={sheet.buyer} onChange={(e) => setSheet({ ...sheet, buyer: e.target.value })}><option value="">Select buyer</option>{sheet.buyer && !buyerOptions.some((option) => option.code === sheet.buyer) && <option value={sheet.buyer}>{sheet.buyer}</option>}{buyerOptions.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}</select></div>
            <div className="field-group compact"><label>Revision</label><input type="number" value={sheet.revisionNumber} onChange={(e) => setSheet({ ...sheet, revisionNumber: Number(e.target.value) })} /></div>
            <div className="field-group compact"><label>Currency</label><select value={sheet.currency} onChange={(e) => setSheet({ ...sheet, currency: e.target.value })}><option value=""></option><option>USD</option><option>EUR</option><option>GBP</option><option>CNY</option></select></div>
            <div className="field-group compact"><label>Royalty Rate</label><input type="number" step="0.01" value={sheet.royaltyRate} onChange={(e) => setSheet({ ...sheet, royaltyRate: Number(e.target.value) })} /></div>
            <div className="field-group full"><label>Notes</label><textarea rows={2} value={sheet.notes} onChange={(e) => setSheet({ ...sheet, notes: e.target.value })} /></div>
          </div>
          </section>

            {renderCostGrid('A. Fabric / Material', ['A'])}
            {renderCostGrid('B. Accessories', ['B'])}
            {renderCostGrid('C. Quota / CM / Overhead', ['C', 'D'])}

          <aside className="panel totals-panel">
          <div className="panel-header">Sticky Totals</div>
          <div className="totals-grid">
            <div><span>Material</span><strong>{totals.material.toFixed(2)}</strong></div>
            <div><span>Accessories</span><strong>{totals.accessories.toFixed(2)}</strong></div>
            <div><span>Quota</span><strong>{totals.quota.toFixed(2)}</strong></div>
            <div><span>CM & Overhead</span><strong>{totals.cm.toFixed(2)}</strong></div>
            <div><span>FOB Price</span><strong>{totals.fob.toFixed(2)}</strong></div>
            <div><span>Royalty</span><strong>{totals.royalty.toFixed(4)}</strong></div>
            <div className="final-total"><span>Final Price</span><strong>{totals.finalPrice.toFixed(4)}</strong></div>
          </div>
          <div className="action-row">
            <button className="primary-btn" onClick={calculateNow}>Calculate</button>
            <button className="secondary-btn" onClick={() => setMessage('Select a grid cell, then paste tab-separated Excel cells.')}>Paste Help</button>
          </div>
            </aside>

            <footer className="panel audit-footer">
          <div><span>Created By</span><strong>Vendor</strong></div>
          <div><span>Created Date</span><strong>2026-09-24</strong></div>
          <div><span>Modified By</span><strong>Vendor</strong></div>
          <div><span>Modified Date</span><strong>2026-09-24</strong></div>
            </footer>
          </div>
          <div className="modal-footer">
            {message && <div className="modal-message">{message}</div>}
            {(sheet.id ?? 0) > 0 && <button className="secondary-btn" type="button" onClick={() => printSavedSheet(sheet.id!)} disabled={printing}>{printing ? 'Preparing...' : 'Print / PDF'}</button>}
            <button className="secondary-btn" onClick={() => setEditorOpen(false)}>Cancel</button>
            <button className="primary-btn" type="button" onClick={saveSheet} disabled={saving}>{saving ? 'Saving...' : sheet.id ? 'Save Changes' : 'Save Record'}</button>
          </div>
        </section>
      </div>}

      {printSheet && <article className="print-document">
        <header className="print-header">
          <div>
            <div className="print-eyebrow">Garment Costing</div>
            <h1>Cost Sheet</h1>
          </div>
          <div className="print-record-number">Record #{printSheet.id}</div>
        </header>
        <section className="print-metadata">
          <div><span>PD Style</span><strong>{printSheet.pdStyle}</strong></div>
          <div><span>Style</span><strong>{printSheet.style}</strong></div>
          <div><span>Vendor</span><strong>{printSheet.vendorName || printSheet.vendor}</strong></div>
          <div><span>Buyer</span><strong>{printSheet.buyerName || printSheet.buyer}</strong></div>
          <div><span>Season</span><strong>{printSheet.season} {printSheet.seasonYear}</strong></div>
          <div><span>Stage</span><strong>{printSheet.stage}</strong></div>
          <div><span>Revision</span><strong>{printSheet.revisionNumber}</strong></div>
          <div><span>Record Status</span><strong>{printSheet.recordStatus}</strong></div>
          <div><span>Currency</span><strong>{printSheet.currency}</strong></div>
          <div><span>Royalty Rate</span><strong>{(printSheet.royaltyRate * 100).toFixed(2)}%</strong></div>
        </section>
        {printSheet.notes && <p className="print-notes"><strong>Notes:</strong> {printSheet.notes}</p>}
        <table className="print-lines">
          <thead><tr><th>Section</th><th>Category</th><th>Item</th><th>Description</th><th>Article</th><th>Supplier</th><th>Qty</th><th>Unit Price</th><th>Amount</th><th>Notes</th></tr></thead>
          <tbody>{printSheet.lines.map((line, index) => <tr key={line.id ?? `${line.sectionCode}-${line.displayOrder}-${index}`}>
            <td>{line.sectionCode}</td><td>{line.categoryName || line.categoryCode}</td><td>{line.itemName}</td><td>{line.description}</td>
            <td>{line.articleNumber}</td><td>{line.supplier}</td><td className="print-number">{line.quantity} {line.quantityUnit}</td>
            <td className="print-number">{line.unitPrice.toFixed(2)} {line.quantityUnit}</td>
            <td className="print-number">{line.calculatedAmount.toFixed(2)}</td><td>{line.notes}</td>
          </tr>)}</tbody>
        </table>
        <section className="print-totals">
          <div><span>Material</span><strong>{(printSheet.materialSubtotal ?? 0).toFixed(2)}</strong></div>
          <div><span>Accessories</span><strong>{(printSheet.accessoriesSubtotal ?? 0).toFixed(2)}</strong></div>
          <div><span>Quota</span><strong>{(printSheet.quotaSubtotal ?? 0).toFixed(2)}</strong></div>
          <div><span>CM &amp; Overhead</span><strong>{(printSheet.cmOverheadSubtotal ?? 0).toFixed(2)}</strong></div>
          <div><span>FOB Price</span><strong>{(printSheet.fobPrice ?? 0).toFixed(2)}</strong></div>
          <div><span>Royalty</span><strong>{(printSheet.royaltyAmount ?? 0).toFixed(4)}</strong></div>
          <div className="print-grand-total"><span>Final Price</span><strong>{(printSheet.finalPriceIncludingRoyalty ?? 0).toFixed(4)}</strong></div>
        </section>
        <footer className="print-footer">Created {printSheet.createdDate ? new Date(printSheet.createdDate).toLocaleDateString() : ''} by {printSheet.createdBy} · Modified {printSheet.modifiedDate ? new Date(printSheet.modifiedDate).toLocaleDateString() : ''} by {printSheet.modifiedBy}</footer>
      </article>}
    </div>
  )
}

export default App
