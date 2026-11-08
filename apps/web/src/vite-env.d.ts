/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  electron?: {
    isElectron: boolean;
    resolveYtStream: (params: { title: string; artist?: string; duration?: number }) => Promise<{
      streamUrl: string;
      videoId?: string;
      title?: string;
      artist?: string;
      duration?: number;
      quality?: string;
    } | null>;
    searchYt?: (query: string, limit?: number) => Promise<any[]>;
    storageLoad?: () => Promise<{
      favorites?: any[];
      playlists?: any[];
      recentlyPlayed?: any[];
      downloads?: any[];
      lastPlayedTrack?: any;
    } | null>;
    storageSave?: (data: any) => Promise<{ success: boolean; error?: string }>;
    downloadTrack?: (track: any) => Promise<{
      success: boolean;
      localFilePath?: string;
      fileName?: string;
      sizeBytes?: number;
      error?: string;
    }>;
    openDownloadsFolder?: () => Promise<{ success: boolean; error?: string }>;
    showItemInFolder?: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    getDownloadsFolder?: () => Promise<string>;
    onUpdaterStatus?: (callback: (data: {
      status: 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error';
      version?: string;
      percent?: number;
      bytesPerSecond?: number;
      error?: string;
    }) => void) => () => void;
    checkForUpdates?: () => Promise<{ status: string; updateInfo?: any; error?: string }>;
    restartAndInstallUpdate?: () => Promise<void>;
  };
}
