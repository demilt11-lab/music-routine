import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.476c1409512d42888f4ac29b42d4e4aa',
  appName: 'BioMusic',
  webDir: 'dist',
  server: {
    url: 'https://476c1409-512d-4288-8f4a-c29b42d4e4aa.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: '#0a0a0c',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    LocalNotifications: {
      smallIcon: 'ic_notification',
      iconColor: '#F97316'
    }
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'BioMusic',
    infoPlist: {
      NSHealthShareUsageDescription: 'BioMusic reads your heart rate from Apple Watch to adapt music to your biometric state in real time.',
      NSHealthUpdateUsageDescription: 'BioMusic may store wellness insights derived from your listening sessions.',
      UIBackgroundModes: ['fetch', 'processing']
    }
  },
  android: {
    backgroundColor: '#0a0a0c'
  }
};

export default config;
