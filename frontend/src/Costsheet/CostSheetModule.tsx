import React, { useState, useMemo, useRef, useEffect, type ClipboardEvent } from 'react'
import type { CostSheetLine, CostSheetHeader, CostSheetSearchResult, GridEditLine, CostCategoryOption, CostStageOption, ActiveCell } from './type'
import { createEmptySheet, calculateLineAmount, generateTempId, cleanUnit } from './util'
import { GRID_COLUMNS } from './const'
//import {useMasterData} from './useMasterData'
//import type {CostSheetHeader, CostSheetSearchResult} from './type'


export const useCostSheetModule = (loginName: string, isAuthorized: boolean,  refreshMasterData: () => Promise<void>
) => {
  const isAuthorizedUser = isAuthorized
    // 這裡面搬進來的 useEffect 和 saveCostSheet 就可以直接用 loginName 和 isAuthorized 了！
  const [categoryDraft, setCategoryDraft] = useState({ sectionCode: '', code: '', name: '' })
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editingStageId, setEditingStageId] = useState<number | null>(null)
  //const [isAuthorized, setIsAuthorized] = useState(false)
  const [isEditorOpen, setEditorOpen] = useState(false)
  const [isSearchOpen, setSearchOpen] = useState(false)
  const [isMaintenanceOpen, setMaintenanceOpen] = useState(false)
  const [maintenanceTab, setMaintenanceTab] = useState<'category' | 'stage'>('category')
  const [printing, setPrinting] = useState(false)

  const [searchCriteria, setSearchCriteria] = useState({ pdStyle: '', style: '', season: '', stage: '', recordStatus: '', vendor: '' })
  const [message, setMessage] = useState('')
  const [searchResults, setSearchResults] = useState<CostSheetSearchResult[]>([])
  const [stageDraft, setStageDraft] = useState('')
  
  
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [saveRefreshFailed, setSaveRefreshFailed] = useState(false)
  const [transactions, setTransactions] = useState<CostSheetSearchResult[]>([])
  const [transactionRefresh, setTransactionRefresh] = useState(0)
  
  //const [sheet, setSheet] = useState<CostSheetHeader>(initialSheet)
  const [sheet, setSheet] = useState<CostSheetHeader>(createEmptySheet)
  const [printSheet, setPrintSheet] = useState<CostSheetHeader | null>(null)

  const [activeCell, setActiveCell] = useState<ActiveCell>({ 
  rowId: '', 
  column: 0, 
  sectionCode: '', 
  isEditing: false 
});

  useEffect(() => {
    if (isEditorOpen && isAuthorized === false && loginName && !sheet.vendor) {
      setSheet((prev) => ({
        ...prev,
        vendor: loginName.trim().toUpperCase()
      }))
    }
  }, [isEditorOpen, isAuthorized, loginName, sheet.vendor])

  useEffect(() => {
    const { pdStyle, style, vendor, buyer } = sheet
    if (![pdStyle, style, vendor, buyer].every((value) => value.trim())) {
      setTransactions([])
      return
    }

    let active = true
    const query = new URLSearchParams({ pdStyle, style, vendor, buyer })
    fetch(`${import.meta.env.VITE_API_BASE_URL}/costsheets/transactions?${query.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Transactions could not be loaded.')
        return await response.json() as CostSheetSearchResult[]
      })
      .then((records) => {
        if (active) setTransactions(records)
      })
      .catch(() => {
        if (active) setMessage('Transactions for this master record could not be loaded.')
      })

    return () => { active = false }
  }, [sheet.pdStyle, sheet.style, sheet.vendor, sheet.buyer, sheet.id, sheet.stage, sheet.season, sheet.seasonYear, sheet.recordStatus, transactionRefresh])

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

  const openMaintenance = async () => {
    setMessage('')
    setMaintenanceOpen(true)
    try {
      await refreshMasterData()
    } catch {
      setMessage('Source table data could not be loaded.')
    }
  }
  const totals = useMemo(() => {
    // 💡 加上 !line.isDeleted 防禦鎖
    const material = sheet.lines
      .filter((line) => line.sectionCode === 'A' && !line.isDeleted)
      .reduce((sum, line) => sum + calculateLineAmount(line.quantity, line.unitPrice), 0)
      
    const accessories = sheet.lines
      .filter((line) => line.sectionCode === 'B' && !line.isDeleted)
      .reduce((sum, line) => sum + calculateLineAmount(line.quantity, line.unitPrice), 0)
      
    const quota = sheet.lines
      .filter((line) => line.sectionCode === 'C' && !line.isDeleted)
      .reduce((sum, line) => sum + calculateLineAmount(line.quantity, line.unitPrice), 0)
      
    const cm = sheet.lines
      .filter((line) => line.sectionCode === 'D' && !line.isDeleted)
      .reduce((sum, line) => sum + calculateLineAmount(line.quantity, line.unitPrice), 0)
      
    const fob = material + accessories + quota + cm
    const royalty = fob * sheet.royaltyRate
    const finalPrice = fob + royalty

    return { material, accessories, quota, cm, fob, royalty, finalPrice }
  }, [sheet.lines, sheet.royaltyRate])

    const saveCategory = async () => {
      const isEditing = editingCategoryId !== null
      const response = await fetch(isEditing ? `${import.meta.env.VITE_API_BASE_URL}/maintenance/categories/${editingCategoryId}` : `${import.meta.env.VITE_API_BASE_URL}/maintenance/categories`, {
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
      const response = await fetch(isEditing ? `${import.meta.env.VITE_API_BASE_URL}/maintenance/stages/${editingStageId}` : `${import.meta.env.VITE_API_BASE_URL}/maintenance/stages`, {
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
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/maintenance/categories/${category.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionCode: category.sectionCode, code: category.code, name: category.name, isActive })
    })
    if (response.ok) await refreshMasterData()
  }

  const setStageActive = async (stage: CostStageOption, isActive: boolean) => {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/maintenance/stages/${stage.id}`, {
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
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/costsheets/search?${query.toString()}`)
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

  const loadCostSheet = async (id: number, openEditor = true) => {
        try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/costsheets/${id}`)
        if (!response.ok) {
            setMessage('The selected cost sheet could not be loaded.')
            return
        }

        const loaded = await response.json() as CostSheetHeader
        setSheet(loaded)
        setSaveRefreshFailed(false)
        setSearchOpen(false)
        setEditorOpen(openEditor)
        setMessage('')
        } catch {
        setMessage('Cost sheet load request failed.')
        }
  }


  const openDerivedSheet = async (id: number, saveAs: boolean) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/costsheets/${id}`)
      if (!response.ok) {
        setMessage('The selected cost sheet could not be loaded.')
        return
      }

      const source = await response.json() as CostSheetHeader
      if (saveAs && source.revisionNumber > 1) {
        setMessage('Records above revision 1 are read-only and cannot be saved as.')
        return
      }
      setSheet({
        ...source,
        id: undefined,
        originalCostSheetId: saveAs ? source.id : undefined,
        revisionNumber: 1,
        recordStatus: 'Draft',
        lines: source.lines.map(({ id: _lineId, ...line }) => line)
      })
      setSaveRefreshFailed(false)
      setEditorOpen(true)
      setMessage('')
    } catch {
      setMessage('Cost sheet copy request failed.')
    }
  }

  const startSaveAs = () => {
    if (!sheet.id || sheet.revisionNumber > 1) return
    setSheet((current) => ({
      ...current,
      id: undefined,
      originalCostSheetId: current.id,
      revisionNumber: 1,
      recordStatus: 'Draft',
      lines: current.lines.map(({ id: _lineId, ...line }) => line)
    }))
    setMessage('')
  }

  const printSavedSheet = async (id: number) => {
      setPrinting(true)
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/costsheets/${id}/print`)
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
    if (savingRef.current) return
      savingRef.current = true
      setSaving(true)
      try {
        const isEditing = (sheet.id ?? 0) > 0
        const filteredLines = sheet.lines.filter((line) => {
          if (line.id) return true
  
          if (line.isDeleted) return false
          // 動態核心欄位檢查：判斷使用者是否有真正輸入業務資料
          const hasContent = 
            line.categoryCode.trim() !== '' ||
            line.categoryName.trim() !== '' ||
            line.itemName.trim() !== '' ||
            line.description.trim() !== '' ||
            line.articleNumber.trim() !== '' ||
            line.supplier.trim() !== '' ||
            (Number(line.quantity) !== 0) ||
            (Number(line.unitPrice) !== 0);
  
          return hasContent;
        });
        const response = await fetch(isEditing ? `${import.meta.env.VITE_API_BASE_URL}/costsheets/${sheet.id}` : `${import.meta.env.VITE_API_BASE_URL}/costsheets`, {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            ...sheet, 
            createdBy: loginName, 
            modifiedBy: loginName,
            lines: filteredLines
          })
        })
  
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          
          // 💡 1. 提取後端傳回的結構化驗證錯誤 (例如主檔不符或欄位缺失)
          const validationMessages = Object.values(error?.errors ?? {}).flat().join(' ')
          const baseMessage = validationMessages || error?.detail || error?.message || 'Server rejected the cost sheet data.'
          
          // 💡 2. 附加清晰的操作程序引導 (Procedure)
          setMessage(
            `❌ Save Failed: ${baseMessage} \n` +
            `👉 Please check: 1) Verify Vendor/Buyer exists in master. 2) Ensure PD Style and Stage are correctly selected. 3) Retrying by clicking 'Calculate' first.`
          )
          return
    }
  
    const saved = await response.json()
        setSheet((current) => ({ ...current, id: saved.id, revisionNumber: saved.revisionNumber, originalCostSheetId: undefined }))
        setTransactionRefresh((current) => current + 1)
  
        try {
          const reloadResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/costsheets/${saved.id}`)
          if (!reloadResponse.ok) throw new Error('Saved record reload failed.')
  
          const reloaded = await reloadResponse.json() as CostSheetHeader
          const expectedLineCounts = filteredLines.reduce<Record<string, number>>((counts, line) => {
            if (!line.isDeleted) counts[line.sectionCode] = (counts[line.sectionCode] ?? 0) + 1
            return counts
          }, {})
          const loadedLineCounts = reloaded.lines.reduce<Record<string, number>>((counts, line) => {
            counts[line.sectionCode] = (counts[line.sectionCode] ?? 0) + 1
            return counts
          }, {})
          const hasValidLineIds = reloaded.lines.every((line) => (line.id ?? 0) > 0)
            && new Set(reloaded.lines.map((line) => line.id)).size === reloaded.lines.length
          const sectionCountsMatch = Object.keys(expectedLineCounts).every(
            (sectionCode) => expectedLineCounts[sectionCode] === (loadedLineCounts[sectionCode] ?? 0)
          ) && Object.keys(loadedLineCounts).every(
            (sectionCode) => loadedLineCounts[sectionCode] === (expectedLineCounts[sectionCode] ?? 0)
          )
  
          if (!hasValidLineIds || !sectionCountsMatch) {
            const sectionSummary = [...new Set([...Object.keys(expectedLineCounts), ...Object.keys(loadedLineCounts)])]
              .map((sectionCode) => `${sectionCode}: expected ${expectedLineCounts[sectionCode] ?? 0}, reloaded ${loadedLineCounts[sectionCode] ?? 0}`)
              .join('; ')
            setSheet(reloaded)
            setSaveRefreshFailed(true)
            setMessage(`Cost sheet was saved, but its line IDs or section counts did not reload correctly (${sectionSummary}). Do not save again; close and reopen the record, then check the database procedure.`)
            return
          }
  
          setSheet(reloaded)
          setSaveRefreshFailed(false)
        } catch {
          setSaveRefreshFailed(true)
          setMessage('Cost sheet was saved, but its saved line IDs could not be reloaded. Do not save again; close this record and reopen it before making more changes.')
          return
        }
  
        setMessage('✅ Cost sheet saved successfully.')
      } catch {
        // 💡 3. 處理斷網、API 未啟動或連線失敗的 Procedure
        setMessage(
          `❌ Connection Error: Cost sheet save request failed. \n` +
          `👉 Procedure to fix: 1) Check if the backend API service is running. 2) Check your network connection. 3) Keep this window open, restart the API, and click 'Save Changes' again.`
        )
      } finally {
        savingRef.current = false
        setSaving(false)
      }
    }
  
    const calculateNow = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/costsheets/recalc`, {
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

    const updateLine = <K extends keyof CostSheetLine>(targetLine: CostSheetLine, field: K, value: CostSheetLine[K] | string) => {
      setSheet((previous) => ({
        ...previous,
        lines: previous.lines.map((line) => {
          // 利用實體唯一特徵（DB實體ID 或 前端 tempId）進行精準比對
          const isMatch = targetLine.id ? line.id === targetLine.id : (targetLine.tempId && line.tempId === targetLine.tempId)
          if (!isMatch) return line
    
          // 1️⃣ 建立新物件，並針對傳入值進行防爆與清洗
          let cleanValue = value;
    
          if (field === 'quantity' || field === 'unitPrice') {
            // 數值防爆：防止從 Excel 貼上帶有千分位逗號的字串（例如 "1,250.50"）或非法字元導到 NaN
            const parsed = typeof value === 'number' 
              ? value 
              : parseFloat(String(value).replace(/,/g, ''));
            cleanValue = (isNaN(parsed) ? 0 : parsed) as CostSheetLine[K];
          } 
          else if (field === 'quantityUnit' || field === 'priceUnit') {
            // 單位清洗：轉大寫並過濾特殊符號（例如 "pcs " -> "PCS"），維持影子單位純淨度
            cleanValue = String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, '') as CostSheetLine[K];
          }
    
          const updatedLine = { ...line, [field]: cleanValue };
    
          // 2️⃣ 觸發連動小計（改用 cleanValue 確保參與計算的絕對是安全數字）
          if (field === 'quantity' || field === 'unitPrice') {
            const q = field === 'quantity' ? Number(cleanValue) : line.quantity;
            const p = field === 'unitPrice' ? Number(cleanValue) : line.unitPrice;
            updatedLine.calculatedAmount = calculateLineAmount(q, p);
          }
    
          // 3️⃣ 影子連動核心雙向防護
          if (field === 'quantityUnit') {
            updatedLine.priceUnit = String(cleanValue); // 💡 用量改，單價單位跟著改
          } else if (field === 'priceUnit') {
            updatedLine.quantityUnit = String(cleanValue); // 💡 萬一貼上事件動到 priceUnit，反向同步防禦
          }
    
          return updatedLine;
        })
      }))
    }
    
    const addLine = (sectionCode: string) => {
      setSheet((previous) => {
        const newLine: CostSheetLine = {
          // 💥 絕對特徵鎖定：與 pasteIntoGrid 統一強制改用原生安全加密 GUID，徹底免除特徵分裂與打字閃爍失焦
          //tempId: crypto.randomUUID(), 
          tempId: generateTempId(), // 強制原生安全 GUID 特徵鎖定
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
          priceUnit: 'PCS',
          calculatedAmount: 0,
          notes: '',
          displayOrder: previous.lines.length + 1,
          //isBlank: false,     // 對接 SAVE JSON 特徵
          isDeleted: false    // 初始化為未刪除
        }
        return { ...previous, lines: [...previous.lines, newLine] }
      })
      setMessage(`New ${sectionCode} row added.`)
    }
    
    const removeLine = (targetLine: CostSheetLine) => {
      setSheet((previous) => {
        const updatedLines = previous.lines.map((line) => {
          // 比對特徵 (同時相容數字型 id 與字串型 tempId)
          const isMatch = targetLine.id ? line.id === targetLine.id : line.tempId === targetLine.tempId
          if (!isMatch) return line
    
          // 💡 如果已經有實體 ID，打上刪除標記以利後端 MERGE 扣除；如果是前端虛擬行，打上標記後續過濾
          return { ...line, isDeleted: true }
        })
    
        // 💡 針對未存檔(只有tempId)且打上 isDeleted 的行，直接實體過濾拔除，不留垃圾
        // 💥 加固防線：同時將沒有實體 id 的純虛擬刪除行徹底洗掉
        const finalLines = updatedLines.filter(line => !(!line.id && line.isDeleted))
    
        // 重新編排剩餘可見橫列的顯示順序
        let visibleIdx = 0
        const orderedLines = finalLines.map((line) => {
          if (line.isDeleted) return line // 已標記刪除的不動順序
          visibleIdx++
          return { ...line, displayOrder: visibleIdx }
        })
    
        return { ...previous, lines: orderedLines }
      })
      setMessage('Row marked as deleted. Save Changes to apply to database.')
    }

    const pasteIntoGrid = (
      event: ClipboardEvent<HTMLTableElement>,
      visibleRowIndexes: number[], // 當前畫面上可見行在全域 sheet.lines 中的真實 index 陣列
      targetSectionCode: string
    ) => {
      event.preventDefault();
      const textData = event.clipboardData?.getData('text') || '';
      if (!textData) return;
    
      // 解析剪貼簿為二維陣列
      const rows = textData.split(/\r?\n/).map(row => row.split('\t'));
      if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
        rows.pop();
      }
      if (rows.length === 0) return;
    
      // 決定起始焦點欄位
      const activeColIdx = activeCell.column;
      const startFieldKey = GRID_COLUMNS[activeColIdx] || 'categoryCode';
      const startColIdx = GRID_COLUMNS.indexOf(startFieldKey);
      if (startColIdx === -1) return;
    
      // 尋找當前焦點行在可見行陣列中的相對位置
      // 透過 DOM 的 data 特徵與 activeCell.rowId 比對
      const relativeRowIdx = visibleRowIndexes.findIndex((globalIdx) => {
        const line = sheet.lines[globalIdx];
        const key = line?.id ? String(line.id) : line?.tempId;
        return key === activeCell.rowId;
      });
      
      const startSectionRowIdx = relativeRowIdx === -1 ? 0 : relativeRowIdx;
    
      setSheet((previous: CostSheetHeader) => {
        // 1️⃣ 深度拷貝現有行陣列（轉換為影子擴充型別以相容 isBlank）
        const nextLines = previous.lines.map(l => ({ ...l })) as GridEditLine[];
    
        // 2️⃣ 篩選出當前 Section 的所有行，建立防線
        const sectionLines = nextLines.filter(l => l.sectionCode === targetSectionCode && !l.isDeleted);
    
        rows.forEach((rowCells, rOffset) => {
          const currentSectionRowIdx = startSectionRowIdx + rOffset;
          let targetRow: GridEditLine;
          
    
          // 🛡️ Section 邊界核心防線：檢查區塊內部是否有對應行可以覆蓋
          if (currentSectionRowIdx < sectionLines.length) {
            const targetTempId = sectionLines[currentSectionRowIdx].tempId;
            const targetId = sectionLines[currentSectionRowIdx].id;
            targetRow = nextLines.find(l => targetId ? l.id === targetId : l.tempId === targetTempId)!;
          } else {
            // 超出區塊現有長度，在該區塊末尾安全進行「精確 Splice 插入拓荒」
            const lastLineInSectionIdx = nextLines.map(l => l.sectionCode).lastIndexOf(targetSectionCode);
    
            const newLine: GridEditLine = {
              id: undefined,
              //tempId: crypto.randomUUID(), // 強制原生安全 GUID 特徵鎖定
              tempId: generateTempId(), // 強制原生安全 GUID 特徵鎖定
              sectionCode: targetSectionCode, // 誓死效忠當前 Section
              categoryCode: '',
              categoryName: '',
              itemName: '',
              description: '',
              articleNumber: '',
              supplier: '',
              quantity: 0,
               quantityUnit: sectionLines[0]?.quantityUnit || 'PCS', // 修正陣列索引安全繼承
              unitPrice: 0,
              priceUnit: sectionLines[0]?.priceUnit || 'PCS',     // 修正陣列索引安全繼承
              calculatedAmount: 0,
              notes: '',
              displayOrder: nextLines.length + 1,
              isDeleted: false
            };
    
            if (lastLineInSectionIdx !== -1) {
              nextLines.splice(lastLineInSectionIdx + 1, 0, newLine);
            } else {
              nextLines.push(newLine);
            }
            targetRow = newLine;
          }
    
          // 安全加固：再次確保行區塊特徵不被竄改
          targetRow.sectionCode = targetSectionCode;
    
          // 3️⃣ 儲存格欄位清洗與寫入
          rowCells.forEach((cellValue, cOffset) => {
            const targetColIdx = startColIdx + cOffset;
            if (targetColIdx >= GRID_COLUMNS.length) return; // 欄位越界防護
    
            let fieldKey = GRID_COLUMNS[targetColIdx];
            const cleanValue = cellValue.trim();
            if (cleanValue === '') {
              if (fieldKey === 'quantity' || fieldKey === 'unitPrice') {
                targetRow[fieldKey] = 0;
              }
              return; 
            }
            
    
            // 單位連動
             if (targetColIdx === 7) { 
              // 確保留在數量 Value
              const numericString = cleanValue.replace(/[^0-9.-]/g, '');
              const parsedNum = parseFloat(numericString);
              targetRow.quantity = isNaN(parsedNum) ? 0 : parsedNum;
            } 
            else if (targetColIdx === 8) { 
              // 確保留在數量 Unit (例如 pcs -> PCS)
              targetRow.quantityUnit = cleanUnit(cleanValue);
              // 影子單位連動：單價的計價單位跟著用量單位走
              targetRow.priceUnit = targetRow.quantityUnit; 
            } 
            else if (targetColIdx === 9 || targetColIdx === 10) { 
              // 💥 修正世紀大坑：不管 Excel 資料是撞到 col 9 還是 col 10，只要這格帶有單價特徵，一律精確歸位到 unitPrice
              const numericString = cleanValue.replace(/[^0-9.-]/g, '');
              const parsedNum = parseFloat(numericString);
              
              // 如果這格確實解析得出數字，代表它就是真正的單價
              if (!isNaN(parsedNum) && parsedNum > 0) {
                targetRow.unitPrice = parsedNum;
              }
              
              // 影子貨幣防線：如果是 US$ 1.00 /PC. 這類格式，自動把計價單位與數量單位對齊，不污染
              if (cleanValue.toUpperCase().includes('US') || cleanValue.includes('$')) {
                // 保持純淨，不要讓單價的字串把 quantityUnit 洗掉
                if (!targetRow.quantityUnit || targetRow.quantityUnit === 'USD') {
                  targetRow.quantityUnit = 'PCS'; 
                  targetRow.priceUnit = 'PCS';
                }
              }
            } 
            else {
              // 常規文字欄位物理歸位 (categoryCode, itemName, description, articleNumber, supplier)
              (targetRow[fieldKey] as any) = cleanValue;
            }
          });
    
          // 重新計算單行小計
          targetRow.calculatedAmount = calculateLineAmount(targetRow.quantity || 0, targetRow.unitPrice || 0);
        });
    
        // 4️⃣ 重新編排整體 displayOrder
        let visibleIdx = 0;
        const finalLines = nextLines.map((line) => {
          if (line.isDeleted) return line;
          visibleIdx++;
          return { ...line, displayOrder: visibleIdx };
        });
    
        return { ...previous, lines: finalLines };
      });
    
      setMessage(`📋 Pasted data successfully inside Section ${targetSectionCode}.`);
    };
    
    
    const handleGridKeyDown = (
      event: React.KeyboardEvent<HTMLInputElement>,
      currentLine: CostSheetLine,
      currentVisibleLines: { line: CostSheetLine; index: number }[]
    ) => {
      const currentKey = currentLine.id ? String(currentLine.id) : currentLine.tempId;
      const currentCol = activeCell.column;
    
      const moveFocus = (targetRowKey: string, targetColIdx: number) => {
        // 透過屬性選取器直接精確鎖定下一個 DOM 節點
        const targetInput = document.querySelector(
          `input[data-grid-row-key="${targetRowKey}"][data-grid-column="${targetColIdx}"]`
        ) as HTMLInputElement;
        if (targetInput) {
          event.preventDefault();
          targetInput.focus();
          // 自動全選，方便快速打字覆蓋
          setTimeout(() => targetInput.select(), 10);
        }
      };
    
      const currentRowIdx = currentVisibleLines.findIndex(
        ({ line }) => (line.id ? String(line.id) : line.tempId) === currentKey
      );
    
      switch (event.key) {
        case 'ArrowUp':
          if (currentRowIdx > 0) {
            const nextLine = currentVisibleLines[currentRowIdx - 1].line;
            const nextKey = nextLine.id ? String(nextLine.id) : nextLine.tempId;
            moveFocus(nextKey!, currentCol);
          }
          break;
    
        case 'ArrowDown':
          if (currentRowIdx < currentVisibleLines.length - 1) {
            const nextLine = currentVisibleLines[currentRowIdx + 1].line;
            const nextKey = nextLine.id ? String(nextLine.id) : nextLine.tempId;
            moveFocus(nextKey!, currentCol);
          }
          break;
    
        case 'ArrowLeft':
          // 只有在游標處於文字最前端或文字全選時才允許跨格導航，防止干擾打字
          if (event.currentTarget.selectionStart === 0 || event.currentTarget.selectionStart === event.currentTarget.value.length) {
            if (currentCol > 1) { // 攔截 col 0 (唯讀區塊)
              moveFocus(currentKey!, currentCol - 1);
            }
          }
          break;
    
        case 'ArrowRight':
          if (event.currentTarget.selectionStart === event.currentTarget.value.length) {
            if (currentCol < GRID_COLUMNS.length - 1) {
              moveFocus(currentKey!, currentCol + 1);
            }
          }
          break;
    
        case 'Tab':
          event.preventDefault(); // 攔截瀏覽器預設跳焦，改用矩陣安全網格跳格
          if (event.shiftKey) {
            if (currentCol > 1) {
              moveFocus(currentKey!, currentCol - 1);
            } else if (currentRowIdx > 0) {
              const prevLine = currentVisibleLines[currentRowIdx - 1].line;
              const prevKey = prevLine.id ? String(prevLine.id) : prevLine.tempId;
              moveFocus(prevKey!, GRID_COLUMNS.length - 1);
            }
          } else {
            if (currentCol < GRID_COLUMNS.length - 1) {
              moveFocus(currentKey!, currentCol + 1);
            } else if (currentRowIdx < currentVisibleLines.length - 1) {
              const nextLine = currentVisibleLines[currentRowIdx + 1].line;
              const nextKey = nextLine.id ? String(nextLine.id) : nextLine.tempId;
              moveFocus(nextKey!, 1);
            }
          }
          break;
    
        case 'Enter':
          event.preventDefault();
          if (currentRowIdx < currentVisibleLines.length - 1) {
            // 向下垂直換行
            const nextLine = currentVisibleLines[currentRowIdx + 1].line;
            const nextKey = nextLine.id ? String(nextLine.id) : nextLine.tempId;
            moveFocus(nextKey!, currentCol);
          } else {
            // 🚀 觸發「最後一行 Enter 拓荒機制」：自動新增行
            addLine(currentLine.sectionCode);
            
            // 延遲等待 React 新增行 state 渲染完畢後，焦點自動往下拓荒
            setTimeout(() => {
              setSheet((latest) => {
                const sameSectionLines = latest.lines.filter(
                  (l) => l.sectionCode === currentLine.sectionCode && !l.isDeleted
                );
                if (sameSectionLines.length > 0) {
                  const lastLine = sameSectionLines[sameSectionLines.length - 1];
                  const lastKey = lastLine.id ? String(lastLine.id) : lastLine.tempId;
                  moveFocus(lastKey!, currentCol);
                }
                return latest;
              });
            }, 60);
          }
          break;
    
        default:
          break;
      }
    };
  
    const renderCostGrid = (title: string, sectionCodes: string[]) => {
  // 1. 篩選出屬於該區域且未被軟刪除的行
  const gridLines = sheet.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => sectionCodes.includes(line.sectionCode) && !line.isDeleted);

    // 2. 空值防護：若該區完全沒行，給予一行初始行
    const visibleLines =
      gridLines.length > 0
        ? gridLines
        : [
            {
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
                priceUnit: 'PCS',
                calculatedAmount: 0,
                notes: '',
                displayOrder: sheet.lines.length + 1
              } as CostSheetLine
            }
          ]
  return (
      <section className="panel grid-panel" key={title}>
        <div className="panel-header grid-panel-header">
          <span>
            {title}{' '}
            <small className="row-count">
              {gridLines.length} row{gridLines.length === 1 ? '' : 's'}
            </small>
          </span>
          <button
            type="button"
            className="add-row-btn"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              addLine(sectionCodes[0])
            }}
          >
            + Add Row
          </button>
        </div>
        <div className="table-scroll">
          <table
            className="cost-grid"
            onPaste={(event) =>
              pasteIntoGrid(
                event,
                gridLines.map(({ index }) => index),
                sectionCodes[0]
              )
            }
          >
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
              {visibleLines.map(({ line, index }) => {
                const rowKey = line.id ? String(line.id) : line.tempId || `stable-row-${index}`

                const cell = (col: number) => {
                  const cellState = { rowId: rowKey, column: col, sectionCode: line.sectionCode, isEditing: true }
                  return {
                    td: { onMouseDown: () => setActiveCell(cellState) },
                    input: {
                      'data-grid-row-key': rowKey,
                      'data-grid-column': col,
                      onFocus: () => setActiveCell(cellState),
                      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => handleGridKeyDown(e, line, gridLines)
                    }
                  }
                }

                return (
                  <tr className="cost-row" key={rowKey} style={{ opacity: line.isDeleted ? 0.4 : 1 }}>
                    <td {...cell(0).td}>
                      <input {...cell(0).input} className="display-input text-center" readOnly value={line.sectionCode} />
                    </td>
                    <td {...cell(1).td}>
                      <input {...cell(1).input} value={line.categoryCode} onChange={(e) => updateLine(line, 'categoryCode', e.target.value)} />
                    </td>
                    <td {...cell(2).td}>
                      <input {...cell(2).input} value={line.categoryName} onChange={(e) => updateLine(line, 'categoryName', e.target.value)} />
                    </td>
                    <td {...cell(3).td}>
                      <input {...cell(3).input} value={line.itemName} onChange={(e) => updateLine(line, 'itemName', e.target.value)} />
                    </td>
                    <td {...cell(4).td}>
                      <input {...cell(4).input} value={line.description} onChange={(e) => updateLine(line, 'description', e.target.value)} />
                    </td>
                    <td {...cell(5).td}>
                      <input {...cell(5).input} value={line.articleNumber} onChange={(e) => updateLine(line, 'articleNumber', e.target.value)} />
                    </td>
                    <td {...cell(6).td}>
                      <input {...cell(6).input} value={line.supplier} onChange={(e) => updateLine(line, 'supplier', e.target.value)} />
                    </td>
                    <td {...cell(7).td}>
                      <input {...cell(7).input} className="amount-input" value={line.quantity || ''} onChange={(e) => updateLine(line, 'quantity', e.target.value)} />
                    </td>
                    <td {...cell(8).td}>
                      <input {...cell(8).input} value={line.quantityUnit} onChange={(e) => updateLine(line, 'quantityUnit', e.target.value)} />
                    </td>
                    <td {...cell(9).td}>
                      <input {...cell(9).input} className="display-input currency-cell" readOnly value={sheet.currency} />
                    </td>
                    <td {...cell(10).td}>
                      <input {...cell(10).input} className="amount-input" value={line.unitPrice || ''} onChange={(e) => updateLine(line, 'unitPrice', e.target.value)} />
                    </td>
                    <td className="numeric" {...cell(11).td}>
                      <input {...cell(11).input} className="display-input numeric" readOnly value={line.calculatedAmount ? line.calculatedAmount.toFixed(2) : '0.00'} />
                    </td>
                    <td>
                      {index >= 0 && (
                        <button type="button" className="remove-btn" onClick={() => removeLine(line)}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  return {
    isEditorOpen,
    isSearchOpen,
    isMaintenanceOpen,
    maintenanceTab,
    setActiveCell,
    editingCategoryId,
    setEditingCategoryId,
    editingStageId,
    setEditingStageId,
    categoryDraft,
    setCategoryDraft,
    stageDraft,
    setStageDraft,
    searchCriteria,
    setSearchCriteria,
    saving,
    transactionRefresh,
    setTransactionRefresh,
    searchResults,
    setSearchResults,
    transactions,
    searching,
    saveRefreshFailed,
    printing,
    sheet,
    printSheet,
    message,
    setMessage,
    openMaintenance,
    totals,
    saveCategory,
    saveStage,
    setCategoryActive,
    setStageActive,
    loadCostSheet,
    openSearch,
    searchCostSheets,
    setEditorOpen,
    setSaveRefreshFailed,
    setSheet,
    setSearchOpen,
    setMaintenanceOpen,
    setMaintenanceTab,
    openDerivedSheet,
    startSaveAs,
    saveSheet,
    printSavedSheet,
    calculateNow,
    addLine,
    removeLine,
    updateLine,
    pasteIntoGrid,
    handleGridKeyDown,
    renderCostGrid
  }
}