// The compare selection is a cookie of product ids, so the server renders the tray and the table with no flash.
// Ids only: the products themselves are looked up from the catalog on the server.
export const COMPARE_COOKIE = 'compare'
export const COMPARE_MAX = 4

export const parseCompare = (value: string | undefined) =>
  [...new Set((value ?? '').split(',').map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))].slice(0, COMPARE_MAX)
