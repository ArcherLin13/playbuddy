/**
 * Check account sessions: node scripts/check-firestore.mjs <email> <password>
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, getFirestore } from 'firebase/firestore';

const email = process.argv[2];
const password = process.argv[3];
if (!email || !password) {
  console.error('Usage: node scripts/check-firestore.mjs <email> <password>');
  process.exit(1);
}

const app = initializeApp({
  apiKey: 'AIzaSyBX6CId7-RATf0P6cz5-DDqFf6nQu0rmoo',
  authDomain: 'playbuddy-ca350.firebaseapp.com',
  projectId: 'playbuddy-ca350',
  storageBucket: 'playbuddy-ca350.firebasestorage.app',
  messagingSenderId: '21502999697',
  appId: '1:21502999697:web:9df885b4228f08cd94d330',
});

const auth = getAuth(app);
const db = getFirestore(app);
const cred = await signInWithEmailAndPassword(auth, email, password);
console.log('auth ok', cred.user.uid, cred.user.email);

const snap = await getDocs(collection(db, 'users', cred.user.uid, 'sessions'));
console.log('sessions:', snap.size);
snap.forEach((d) => {
  const s = d.data();
  console.log('-', d.id, {
    effectiveMs: s.effectiveMs,
    boutCount: s.boutCount,
    score: s.score,
    earnedYuan: s.earnedYuan,
    segments: Array.isArray(s.segments) ? s.segments.length : 0,
    hasAudio: Array.isArray(s.segments) && s.segments.some((x) => x.audioUri),
  });
});
