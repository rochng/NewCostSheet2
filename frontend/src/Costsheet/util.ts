import type { CostSheetHeader } from './type'

export const createEmptySheet = (defaultVendor = ''): CostSheetHeader => ({
  vendor: defaultVendor,
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

export const generateTempId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export function calculateLineAmount(quantity: number, unitPrice: number) {
  const q = Number.isFinite(quantity) ? quantity : 0
  const p = Number.isFinite(unitPrice) ? unitPrice : 0
  return Math.max(0, q * p)
}
export function parseNumericCell(value: string) {
  const normalized = value.replace(/,/g, '').replace(/[^0-9.-]/g, '')
  return Number(normalized) || 0
}
//
export function isCurrencyCell(value: string) {
  return /^(US\$|USD|EUR|GBP|CNY|\$|€|£)\s*$/i.test(value.trim())
}
export function isFormattedPriceCell(value: string) {
  return /^(?:(?:US\$|USD|EUR|GBP|CNY|\$|€|£)\s*)?\(?-?\d+(?:[.,]\d+)?(?:\s+.+)?\)?\s*$/i.test(value.trim())
}

export const cleanUnit = (rawUnit: string) => String(rawUnit).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');




//import {createEmptySheet, calculateLineAmount, parseNumericCell, isCurrencyCell, isFormattedPriceCell} from ./util