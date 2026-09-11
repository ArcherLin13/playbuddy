import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import type { PracticeSession } from '../types';
import { getDb, requireUid } from './firebase';
import { isFirebaseConfigured } from './firebaseConfig';
import { daySessionId } from '../storage/history';
import {
  mergeLocalAndCloud,
  stripAudio,
  type CloudSession,
} from './practiceSyncLogic';

export type { CloudSession };
export { stripAudio, mergeSessionsPreservingAudio, mergeLocalAndCloud } from './practiceSyncLogic';

export type SyncResult = {
  sessions: PracticeSession[];
  pushed: number;
  pulled: number;
};

function sessionsPath(uid: string) {
  return collection(getDb(), 'users', uid, 'sessions');
}

export async function pullCloudSessions(uid: string): Promise<CloudSession[]> {
  const snap = await getDocs(sessionsPath(uid));
  const out: CloudSession[] = [];
  snap.forEach((d) => {
    const data = d.data() as CloudSession;
    if (data && data.id) out.push({ ...data, id: data.id });
  });
  return out;
}

export async function pushCloudSession(uid: string, session: PracticeSession): Promise<void> {
  const cloud = stripAudio(session);
  const id = cloud.id.startsWith('day-') ? cloud.id : daySessionId(cloud.startedAt);
  await setDoc(doc(sessionsPath(uid), id), { ...cloud, id }, { merge: true });
}

export async function pushAllSessions(uid: string, sessions: PracticeSession[]): Promise<number> {
  let n = 0;
  for (const s of sessions) {
    await pushCloudSession(uid, s);
    n += 1;
  }
  return n;
}

export async function deleteCloudSession(sessionId: string): Promise<void> {
  const uid = requireUid();
  await deleteDoc(doc(sessionsPath(uid), sessionId));
}

/** Sync practice metadata for the signed-in account. Audio stays local. */
export async function syncPracticeRecords(local: PracticeSession[]): Promise<SyncResult> {
  if (!isFirebaseConfigured()) {
    throw new Error('请先在 firebaseConfig.ts 填入 Firebase 配置');
  }
  const uid = requireUid();
  const remote = await pullCloudSessions(uid);
  const merged = mergeLocalAndCloud(local, remote);
  const pushed = await pushAllSessions(uid, merged);

  return {
    sessions: merged,
    pushed,
    pulled: remote.length,
  };
}
