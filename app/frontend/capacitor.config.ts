import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.propertydna.app',
  appName: 'PropertyDNA',
  webDir: 'dist',
  // Load live site so content updates ship without App Store review
  server: {
    url: 'https://thepropertydna.com',
    cleartext: false,
    allowNavigation: ['*.thepropertydna.com', '*.supabase.co'],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#020408',
    },
    SplashScreen: {
      launchShowDuration: 2500,
      backgroundColor: '#020408',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#00ff88',
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
