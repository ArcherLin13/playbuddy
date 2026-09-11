import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  // @ts-expect-error RN persistence export exists at runtime in firebase/auth
  getReactNativePersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc, type Firestore } from 'firebase/firestore';
import { FIREBASE_CONFIG, isFirebaseConfigured } from './firebaseConfig';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase 尚未配置');
  }
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(FIREBASE_CONFIG);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  const firebaseApp = getFirebaseApp();
  try {
    auth = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    auth = getAuth(firebaseApp);
  }
  return auth;
}

export function getDb(): Firestore {
  if (!db) db = getFirestore(getFirebaseApp());
  return db;
}

export function getCurrentUser(): User | null {
  if (!isFirebaseConfigured()) return null;
  return getFirebaseAuth().currentUser;
}

export function requireUid(): string {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) throw new Error('请先登录账号');
  return uid;
}

export function subscribeAuth(cb: (user: User | null) => void): () => void {
  if (!isFirebaseConfigured()) {
    cb(null);
    return () => undefined;
  }
  return onAuthStateChanged(getFirebaseAuth(), cb);
}

export async function registerWithEmail(email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  return cred.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  return cred.user;
}

export async function signOutAccount(): Promise<void> {
  await signOut(getFirebaseAuth());
}

function profileRef(uid: string) {
  return doc(getDb(), 'users', uid, 'meta', 'profile');
}

/** Prefer cloud custom name, then Auth displayName, then Google given name. */
export async function loadAccountDisplayName(user: User): Promise<string> {
  try {
    const snap = await getDoc(profileRef(user.uid));
    const remote = snap.data()?.displayName;
    if (typeof remote === 'string' && remote.trim()) return remote.trim();
  } catch {
    /* offline */
  }
  if (user.displayName?.trim()) return user.displayName.trim();
  return '';
}

export async function saveAccountDisplayName(name: string): Promise<string> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('请先登录账号');
  const trimmed = name.trim().slice(0, 24);
  if (!trimmed) throw new Error('名字不能为空');
  await updateProfile(user, { displayName: trimmed });
  await setDoc(
    profileRef(user.uid),
    { displayName: trimmed, updatedAt: Date.now() },
    { merge: true }
  );
  return trimmed;
}
