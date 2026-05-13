import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thepropertydna.app',
  appName: 'PropertyDNA',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#020408',
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 2500,
      backgroundColor: '#020408',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#00ff88',
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com', 'apple.com'],
    },
  },
};

export default config;
