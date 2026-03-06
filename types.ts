
export interface OCRResult {
  id: string;
  originalImage: string;
  extractedText: string;
  timestamp: number;
  summary?: string;
  translation?: string;
}

export enum ProcessState {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

export interface ProcessingStatus {
  state: ProcessState;
  message?: string;
}
