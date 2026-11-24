import { useState} from 'react'
//import { v4 as uuidv4 } from 'uuid'; // 確保新行有唯一 tempId 防止失焦
//import type { ActiveCell } from './Costsheet/type'
import {useMasterData} from './Costsheet/useMasterData'
import {useCostSheetModule} from './Costsheet/CostSheetModule'
import {costSheetStatuses} from './Costsheet/const'
import {createEmptySheet} from './Costsheet/util'

//crypto.randomUUID() // 瀏覽器原生產生 UUID 方法，免裝任何套件與型別檔
//
//Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
//temp.
//Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
//npm i --save-dev @types/uuid

function App() {
  const { vendorOptions, buyerOptions, sections, categories, stages, refreshMasterData } = useMasterData()

  const [isLoggedIn, setLoggedIn] = useState(false)
  const [loginName, setLoginName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('')
  const [isAuthorized, setIsAuthorized] = useState(false)
  const isAuthorizedUser = isAuthorized

  const {
    isEditorOpen, isSearchOpen, isMaintenanceOpen, maintenanceTab,
    editingCategoryId, setEditingCategoryId, editingStageId, setEditingStageId,
    categoryDraft, setCategoryDraft, stageDraft, setStageDraft,
    searchCriteria, setSearchCriteria, saving,
    searchResults, setSearchResults, transactions, searching, saveRefreshFailed, printing,
    sheet, printSheet, message, setMessage,
    openMaintenance, totals, saveCategory, saveStage, setCategoryActive, setStageActive,
    loadCostSheet, openSearch, searchCostSheets,
    setEditorOpen, setSaveRefreshFailed, setSheet, setSearchOpen, setMaintenanceOpen, setMaintenanceTab,
    openDerivedSheet, startSaveAs, saveSheet, printSavedSheet, calculateNow,
    renderCostGrid
  } = useCostSheetModule(loginName, isAuthorized, refreshMasterData)

  
/*
  const [vendorOptions, setVendorOptions] = useState<MasterOption[]>([])
  const [buyerOptions, setBuyerOptions] = useState<MasterOption[]>([])
  const [sections, setSections] = useState<MasterOption[]>([])
  const [categories, setCategories] = useState<CostCategoryOption[]>([])
  const [stages, setStages] = useState<CostStageOption[]>([])
   const refreshMasterData = async () => {
    //const response = await fetch('${import.meta.env.VITE_API_BASE_URL}/costsheets/masters')
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/costsheets/masters`)
    if (!response.ok) throw new Error('Could not load source table data.')
    const masters = await response.json()
    setVendorOptions(masters.vendors || [])
    setBuyerOptions(masters.buyers || [])
    setSections(masters.sections || [])
    setCategories(masters.categories || [])
    setStages(masters.stages || [])
  }
*/
/*
  useEffect(() => {
    if (isEditorOpen && isAuthorized === false && loginName && !sheet.vendor) {
      setSheet((prev) => ({
        ...prev,
        vendor: loginName.trim().toUpperCase()
      }))
    }
  }, [isEditorOpen, isAuthorized, loginName, sheet.vendor])

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
*/
  const login = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/login`, {
      //const response = await fetch('/vendorPortalAPI/api/login', {
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
      const resolvedUsername = result.username || result.fullName || result.loginName || loginName
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

  if (!isLoggedIn) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-brand">Vendor Portal</div>
          <div className="login-subtitle">Enterprise Cost Sheet</div>
          <div className="field-group">
            <label>Username</label>
            <input value={loginName} onChange={(event) => setLoginName(event.target.value.toUpperCase())} />
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
          <button className="toolbar-btn primary" onClick={() => {
            const defaultVendor = isAuthorized === false ? loginName : ''
            setSheet(createEmptySheet(defaultVendor))
            setSaveRefreshFailed(false)
            setEditorOpen(true)
            setMessage('')
          }}>New Cost Sheet</button>
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
            <button className="primary-btn" onClick={() => {
              const defaultVendor = isAuthorized === false ? loginName : ''
                setSheet(createEmptySheet(defaultVendor))
                setSaveRefreshFailed(false)
                setEditorOpen(true)
                setMessage('')
              }}>+ New Record</button>
          </div>
          <div className="summary-meta">
            <div><span>PD Style</span><strong>{sheet.pdStyle}</strong></div>
            <div><span>Style</span><strong>{sheet.style}</strong></div>
            <div><span>Buyer</span><strong>{sheet.buyer}</strong></div>
            <div><span>Vendor</span><strong>{sheet.vendor}</strong></div>
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
                  <th>Season</th>
                  <th>Stage</th>
                  <th>Record Status</th>
                  <th>Modified Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((record) => <tr key={record.id}>
                  <td>{record.revisionNumber}</td>
                  <td>{record.season}</td>
                  <td>{record.stage}</td>
                  <td><span className="status-pill">{record.recordStatus}</span></td>
                  <td>{record.modifiedDate ? new Date(record.modifiedDate).toLocaleDateString() : ''}</td>
                  <td className="record-actions">
                    {record.revisionNumber === 1
                      ? <button className="edit-btn" onClick={() => loadCostSheet(record.id)}>Edit</button>
                      : <button className="edit-btn" onClick={() => loadCostSheet(record.id, false)}>View</button>}
                    {record.revisionNumber === 1 && <button className="edit-btn" onClick={() => openDerivedSheet(record.id, true)}>Save As</button>}
                    <button className="edit-btn" onClick={() => openDerivedSheet(record.id, false)}>Copy</button>
                  </td>
                </tr>)}
                {transactions.length === 0 && <tr><td className="empty-results" colSpan={6}>No transactions found for this master record.</td></tr>}
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
                ? <select value={searchCriteria.vendor} onChange={(event) => setSearchCriteria({ ...searchCriteria, vendor: event.target.value })}><option value="">All vendors</option>{vendorOptions.map((vendor) => <option key={vendor.code} value={vendor.code}>{vendor.code}</option>)}</select>
                : <input value={loginName} readOnly aria-readonly="true" />}</div>
            </div>
            <div className="search-actions"><button className="primary-btn" onClick={searchCostSheets} disabled={searching}>{searching ? 'Searching...' : 'Search'}</button><button className="secondary-btn" onClick={() => { setSearchCriteria({ pdStyle: '', style: '', season: '', stage: '', recordStatus: '', vendor: isAuthorizedUser ? '' : loginName }); setSearchResults([]) }}>Clear</button></div>
            <div className="search-results-wrap">
              <table className="record-table search-results">
                <thead><tr><th>PD Style</th><th>Style</th><th>Vendor</th><th>Season</th><th>Revision</th><th>Stage</th><th>Record Status</th><th>Modified Date</th><th>Action</th></tr></thead>
                <tbody>{searchResults.map((result) => <tr key={result.id}><td className="strong-cell">{result.pdStyle}</td><td>{result.style}</td><td>{result.vendor}</td><td>{result.season}</td><td>{result.revisionNumber}</td><td>{result.stage}</td><td>{result.recordStatus}</td><td>{result.modifiedDate ? new Date(result.modifiedDate).toLocaleDateString() : ''}</td><td><button className="edit-btn" onClick={() => loadCostSheet(result.id, false)}>Select</button></td></tr>)}
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
            <div className="field-group compact"><label>PD Style</label><input value={sheet.pdStyle} onChange={(e) => setSheet({ ...sheet, pdStyle: e.target.value })} readOnly={Boolean(sheet.id)} /></div>
            <div className="field-group compact"><label>Style</label><input value={sheet.style} onChange={(e) => setSheet({ ...sheet, style: e.target.value })} readOnly={Boolean(sheet.id)} /></div>
            <div className="field-group compact season-field"><label>Season</label><div className="season-controls"><select value={sheet.season} onChange={(e) => setSheet({ ...sheet, season: e.target.value })}><option value=""></option><option>Spring</option><option>Summer</option><option>Fall</option><option>Winter</option></select><select aria-label="Season Year" value={sheet.seasonYear} onChange={(e) => setSheet({ ...sheet, seasonYear: e.target.value })}><option value=""></option><option>2026</option><option>2027</option><option>2028</option></select></div></div>
            <div className="field-group compact"><label>Stage</label><select value={sheet.stage} onChange={(e) => setSheet({ ...sheet, stage: e.target.value })}><option value=""></option>{stages.filter((stage) => stage.isActive).map((stage) => <option key={stage.id} value={stage.name}>{stage.name}</option>)}</select></div>
            <div className="field-group compact"><label>Record Status</label><select required value={sheet.recordStatus} onChange={(e) => setSheet({ ...sheet, recordStatus: e.target.value })}>{costSheetStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
            <div className="field-group compact"><label>Vendor !!</label><select required value={sheet.vendor} onChange={(e) => setSheet({ ...sheet, vendor: e.target.value })}  disabled={isAuthorized === false} className={`form-control ${ isAuthorized === false ? 'bg-gray-100 cursor-not-allowed pointer-events-none opacity-70' : ''}`}   ><option value="">Select vendor</option>{sheet.vendor && !vendorOptions.some((option) => option.code === sheet.vendor) && <option value={sheet.vendor}>{sheet.vendor}</option>}{vendorOptions.map((option) => <option key={option.code} value={option.code}>{option.code}</option>)}</select></div>
            <div className="field-group compact"><label>Buyer</label><select required value={sheet.buyer} onChange={(e) => setSheet({ ...sheet, buyer: e.target.value })}><option value="">Select buyer</option>{sheet.buyer && !buyerOptions.some((option) => option.code === sheet.buyer) && <option value={sheet.buyer}>{sheet.buyer}</option>}{buyerOptions.map((option) => <option key={option.code} value={option.code}>{option.code}</option>)}</select></div>
            <div className="field-group compact"><label>Revision</label><input type="number" value={sheet.revisionNumber} readOnly /></div>
            <div className="field-group compact"><label>Currency</label><select value={sheet.currency} onChange={(e) => setSheet({ ...sheet, currency: e.target.value })}><option value=""></option><option>USD</option><option>EUR</option><option>GBP</option><option>CNY</option></select></div>
            <div className="field-group compact"><label>Royalty Rate</label><input type="number" step="0.01" value={sheet.royaltyRate} onChange={(e) => setSheet({ ...sheet, royaltyRate: Number(e.target.value) })} /></div>
            <div className="field-group full"><label>Notes</label><textarea rows={2} value={sheet.notes} onChange={(e) => setSheet({ ...sheet, notes: e.target.value })} /></div>
          </div>
          </section>
            <div><strong>isAuthorized 變數型別:</strong> {typeof isAuthorized}</div>
            <div><strong>isAuthorized 實際值:</strong> {isAuthorized === true ? "🟢 TRUE (內部人員，可改 Vendor)" : isAuthorized === false ? "🔴 FALSE (外部廠商，應唯讀)" : "⚠️ undefined/null (狀態未寫入)"} isAuthorized/ {isAuthorized} </div>
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
            {/* 💡 動態判斷：如果訊息包含 ❌ 或 Failed，自動套用紅色錯誤樣式與斷行顯示 */}
            {message && (
              <div 
                className="modal-message" 
                style={{ 
                  color: message.includes('❌') ? '#ff4d4f' : '#52c41a', // ❌ 爆紅 / ✅ 翠綠
                  fontWeight: 'bold', textAlign: 'left', marginRight: 'auto',
                  whiteSpace: 'pre-line', // 💡 確保訊息中的 \n 換行與 Procedure 步驟能完美分行呈現
                  backgroundColor: message.includes('❌') ? '#fff2f0' : '#f6ffed', // 淺紅底 / 淺綠底
                  padding: '10px 15px', borderRadius: '6px', border: `1px solid ${message.includes('❌') ? '#ffccc7' : '#b7eb8f'}`,
                  width: '100%', marginBottom: '10px'
                }}
              >
                {message}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
              {(sheet.id ?? 0) > 0 && <button className="secondary-btn" type="button" onClick={() => printSavedSheet(sheet.id!)} disabled={printing}>{printing ? 'Preparing...' : 'Print / PDF'}</button>}
              <button className="secondary-btn" onClick={() => setEditorOpen(false)}>Cancel</button>
              {(sheet.id ?? 0) > 0 && sheet.revisionNumber === 1 && <button className="secondary-btn" type="button" onClick={startSaveAs} disabled={saving}>Save As</button>}
              <button className="primary-btn" type="button" onClick={saveSheet} disabled={saving || saveRefreshFailed}>{saving ? 'Saving...' : sheet.id ? 'Save Changes' : sheet.originalCostSheetId ? 'Save As Copy' : 'Save Record'}</button>
            </div>
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