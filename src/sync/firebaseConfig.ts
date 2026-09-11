/**
 * Firebase Web app config (playbuddy-ca350).
 * Security relies on Auth + Firestore rules, not hiding these client keys.
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBX6CId7-RATf0P6cz5-DDqFf6nQu0rmoo',
  authDomain: 'playbuddy-ca350.firebaseapp.com',
  projectId: 'playbuddy-ca350',
  storageBucket: 'playbuddy-ca350.firebasestorage.app',
  messagingSenderId: '21502999697',
  appId: '1:21502999697:web:9df885b4228f08cd94d330',
};

/**
 * Google Sign-In client IDs.
 * Web client ID: Firebase Console → Authentication → Sign-in method → Google
 *   →「Web SDK 配置」里的「Web 客户端 ID」
 * iOS / Android client IDs: optional; add in Google Cloud Console for production builds.
 */
export const GOOGLE_AUTH = {
  webClientId: '',
  iosClientId: '',
  androidClientId: '',
};

export function isFirebaseConfigured(): boolean {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(GOOGLE_AUTH.webClientId.trim());
}
