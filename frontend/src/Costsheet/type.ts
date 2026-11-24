

export type CostSheetLine = {
  id?: number
  tempId?: string // 
  isDeleted?: boolean
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
export type GridEditLine = CostSheetLine & {
  costSheetId?: number; // 影子外鍵：用於 Dapper 批量寫入
  isBlank?: boolean;    // 影子標記：用於前端垃圾過濾
};
export interface ActiveCell {
  rowId: string;       // 儲存 line.id 轉字串，或 line.tempId
  column: number;      // 欄位索引
  columnKey?: keyof CostSheetLine; 
  sectionCode: string; // 當前所屬的 SectionCode
  isEditing: boolean;  // 是否處於編輯狀態
}
//
//CostSheetLine, CostSheetHeader, CostSheetSearchResult, GridEditLine, MasterOption, CostCategoryOption, CostStageOption
export type CostSheetHeader = {
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

export type CostSheetSearchResult = {
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

export type MasterOption = {
  code: string
  name: string
}

export type CostCategoryOption = {
  id: number
  sectionCode: string
  code: string
  name: string
  isActive: boolean
}

export type CostStageOption = {
  id: number
  name: string
  isActive: boolean
}

/*
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

type CostSheetLine = {
  id?: number
  tempId?: string // 
  isDeleted?: boolean
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
type GridEditLine = CostSheetLine & {
  costSheetId?: number; // 影子外鍵：用於 Dapper 批量寫入
  isBlank?: boolean;    // 影子標記：用於前端垃圾過濾
};
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
interface ActiveCell {
  rowId: string;       // 儲存 line.id 轉字串，或 line.tempId
  column: number;      // 欄位索引
  columnKey?: keyof CostSheetLine; 
  sectionCode: string; // 當前所屬的 SectionCode
  isEditing: boolean;  // 是否處於編輯狀態
}


interface PasteContext {
  targetSectionCode: string;
  startGlobalIdx: number;
  startFieldKey: keyof CostSheetLine;
  previousId?: number;
}
*/