
export interface ImageFile {
  id: string;
  file: File;
  preview: string;
  base64: string;
}

export interface BatchItem {
  id: string;
  name: string;
  images: ImageFile[];
  status: 'idle' | 'processing' | 'completed' | 'error' | 'stopping';
  processingMode?: 'normal' | 'pro';
  resultsNormal: string[];
  resultsPro: string[];
  customPrompt?: string;
  error?: string;
}

export interface ImageAdjustments {
  brightness: number;
  contrast: number;
  rotation: number;
}
