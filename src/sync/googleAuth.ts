import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential, type User } from 'firebase/auth';
import { getFirebaseAuth } from './firebase';
import { GOOGLE_AUTH, isGoogleAuthConfigured } from './firebaseConfig';

WebBrowser.maybeCompleteAuthSession();

/** Satisfies expo-auth-session platform checks when Google is not configured yet. */
const PLACEHOLDER_CLIENT_ID = '000000000000-expo-go-placeholder.apps.googleusercontent.com';

function platformClientId(): string {
  if (Platform.OS === 'ios') {
    return GOOGLE_AUTH.iosClientId.trim() || GOOGLE_AUTH.webClientId.trim() || PLACEHOLDER_CLIENT_ID;
  }
  if (Platform.OS === 'android') {
    return (
      GOOGLE_AUTH.androidClientId.trim() || GOOGLE_AUTH.webClientId.trim() || PLACEHOLDER_CLIENT_ID
    );
  }
  return GOOGLE_AUTH.webClientId.trim() || PLACEHOLDER_CLIENT_ID;
}

/** True when real Google client IDs are set for the current platform (not placeholders). */
export function isGoogleSignInReady(): boolean {
  if (!isGoogleAuthConfigured()) return false;
  if (Platform.OS === 'ios') {
    return Boolean(GOOGLE_AUTH.iosClientId.trim() || GOOGLE_AUTH.webClientId.trim());
  }
  if (Platform.OS === 'android') {
    return Boolean(GOOGLE_AUTH.androidClientId.trim() || GOOGLE_AUTH.webClientId.trim());
  }
  return true;
}

export function useGoogleAuthRequest() {
  const web = GOOGLE_AUTH.webClientId.trim() || PLACEHOLDER_CLIENT_ID;
  const ios = GOOGLE_AUTH.iosClientId.trim() || web;
  const android = GOOGLE_AUTH.androidClientId.trim() || web;

  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    clientId: platformClientId(),
    webClientId: web,
    iosClientId: ios,
    androidClientId: android,
  });

  return {
    ready: Boolean(request && isGoogleSignInReady()),
    promptAsync,
  };
}

export async function signInWithGoogleIdToken(idToken: string): Promise<User> {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(getFirebaseAuth(), credential);
  return result.user;
}

export async function completeGoogleSignIn(
  promptAsync: ReturnType<typeof Google.useIdTokenAuthRequest>[2]
): Promise<User | null> {
  if (!isGoogleSignInReady()) {
    throw new Error(
      '请在 firebaseConfig.ts 填入 Google Client ID。iOS 需要 iosClientId（或 webClientId）。Expo Go 请先用邮箱密码测试。'
    );
  }
  const result = await promptAsync();
  if (result.type === 'cancel' || result.type === 'dismiss') return null;
  if (result.type !== 'success') {
    throw new Error('Google 登录失败');
  }
  const idToken = result.params.id_token;
  if (!idToken) {
    throw new Error('未拿到 Google 登录凭证，请用开发构建再试；Expo Go 请用邮箱密码');
  }
  return signInWithGoogleIdToken(idToken);
}
