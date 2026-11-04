import type { WorkbookApi } from '../shared/api'

declare global {
  interface Window {
    api: WorkbookApi
  }
}

export {}
