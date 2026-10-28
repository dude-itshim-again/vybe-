export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  bundledWebRuntime?: boolean;
  server?: {
    androidScheme?: string;
    cleartext?: boolean;
    url?: string;
    hostname?: string;
  };
  android?: {
    allowMixedContent?: boolean;
    backgroundColor?: string;
    captureInput?: boolean;
  };
}

const config: CapacitorConfig = {
  appId: 'com.vybe.music',
  appName: 'Vybe',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#050507',
  },
};

export default config;
