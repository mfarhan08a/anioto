interface StoreConfig {
  recognitionUrl: string | null;
  helperUrl: string;
}

declare const ANIOTO_STORE_CONFIG: StoreConfig | null;

export const storeConfig = typeof ANIOTO_STORE_CONFIG === 'undefined' ? null : ANIOTO_STORE_CONFIG;
