import type { CostSheetLine } from './type'
// 根據您提供的 CostSheetLine 實體型別與畫面橫向 Input 順序完全校準
export const GRID_COLUMNS: (keyof CostSheetLine)[] = [
  'sectionCode'        // col 0: 畫面 Sub-Section (暫對接區塊代碼)
  ,'categoryCode'        // col 1: 畫面 Category Code
  ,'categoryName'       // col 2: 畫面 Category
  ,'itemName'           // col 3: 畫面 Item
  ,'description'        // col 4: 畫面 Description
  ,'articleNumber'      // col 5: 畫面 Article No
  ,'supplier'           // col 6: 畫面 Supplier
  ,'quantity'           // col 7: 畫面 Consumption -> Value
  ,'quantityUnit'       // col 8: 畫面 Consumption -> Unit (影子單位)
  ,'priceUnit'          // col 9: 畫面 Unit Price -> Currency (影子單位)
  ,'unitPrice'          // col 10 畫面 Unit Price -> Unit Price
  ,'calculatedAmount'    // col 11: 畫面 Amount -> Calculated (唯讀金額)
];
export const costSheetStatuses = ['Draft', 'Submitted', 'Approved', 'Archive']
export const gridFields: Array<keyof CostSheetLine | null> = ['sectionCode', 'categoryCode', 'categoryName', 'itemName', 'description', 'articleNumber', 'supplier', 'quantity', 'quantityUnit', null, 'unitPrice', null, null]
