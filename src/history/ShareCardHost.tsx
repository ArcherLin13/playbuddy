import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH, ShareCard, type ShareCardData } from './ShareCard';

type Pending = {
  data: ShareCardData;
  resolve: () => void;
  reject: (error: unknown) => void;
};

let enqueue: ((pending: Pending) => void) | null = null;

/** Capture a styled card as PNG and open the system share sheet (WeChat-friendly). */
export function sharePracticeCard(data: ShareCardData): Promise<void> {
  if (!enqueue) {
    return Promise.reject(new Error('ShareCardHost is not mounted'));
  }
  return new Promise((resolve, reject) => {
    enqueue!({ data, resolve, reject });
  });
}

export function ShareCardHost() {
  const cardRef = useRef<View>(null);
  const [active, setActive] = useState<Pending | null>(null);
  const [ready, setReady] = useState(false);
  const queueRef = useRef<Pending[]>([]);
  const busyRef = useRef(false);

  const pump = () => {
    if (busyRef.current || queueRef.current.length === 0) return;
    busyRef.current = true;
    setReady(false);
    setActive(queueRef.current.shift()!);
  };

  useEffect(() => {
    enqueue = (item) => {
      queueRef.current.push(item);
      pump();
    };
    return () => {
      enqueue = null;
    };
  }, []);

  useEffect(() => {
    if (!active || !ready) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        if (!cardRef.current) throw new Error('Share card view missing');
        // Full-opacity offscreen capture — near-zero opacity makes iOS snapshot digits as 0.
        const uri = await captureRef(cardRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
          width: SHARE_CARD_WIDTH,
          height: SHARE_CARD_HEIGHT,
        });
        if (cancelled) return;
        const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'image/png',
            UTI: 'public.png',
            dialogTitle: '分享练琴记录',
          });
        }
        active.resolve();
      } catch (error) {
        active.reject(error);
      } finally {
        if (!cancelled) {
          setActive(null);
          setReady(false);
          busyRef.current = false;
          setTimeout(() => pump(), 0);
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, ready]);

  if (!active) return null;

  return (
    <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
      <View
        ref={cardRef}
        collapsable={false}
        onLayout={() => setReady(true)}
        style={styles.captureBox}
      >
        <ShareCard data={active.data} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Keep fully opaque but outside the visible viewport.
  offscreen: {
    position: 'absolute',
    left: -(SHARE_CARD_WIDTH + 80),
    top: 0,
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    opacity: 1,
  },
  captureBox: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: '#0E0B09',
  },
});
