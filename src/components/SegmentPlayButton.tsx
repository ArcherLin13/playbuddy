import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { enterPlaybackAudioMode, getOutputVolume } from '../audio/audioMode';
import { colors, radius } from '../theme';

type Props = {
  uri?: string;
  /** Currently allowed playing uri; only this one may play. */
  activeUri: string | null;
  onActiveChange: (uri: string | null) => void;
};

function normalizePlaybackUri(uri: string): string {
  if (
    uri.startsWith('file://') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('content://')
  ) {
    return uri;
  }
  return `file://${uri}`;
}

export function SegmentPlayButton({ uri, activeUri, onActiveChange }: Props) {
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);

  const releasePlayer = () => {
    try {
      playerRef.current?.pause();
      playerRef.current?.remove();
    } catch {
      /* ignore */
    }
    playerRef.current = null;
  };

  useEffect(() => {
    return () => {
      releasePlayer();
    };
  }, []);

  // Another clip took over — stop this one.
  useEffect(() => {
    if (!uri) return;
    if (activeUri !== uri && playing) {
      try {
        playerRef.current?.pause();
      } catch {
        /* ignore */
      }
      setPlaying(false);
    }
  }, [activeUri, uri, playing]);

  if (!uri) {
    return <Text style={styles.na}>无录音</Text>;
  }

  const toggle = async () => {
    try {
      if (playing && playerRef.current) {
        playerRef.current.pause();
        setPlaying(false);
        onActiveChange(null);
        return;
      }

      // Stop any other clip first.
      onActiveChange(uri);

      // Switch out of mic/session category so iOS uses the loudspeaker.
      await enterPlaybackAudioMode();
      // Recreate player after mode change — reused players keep the old route.
      releasePlayer();

      const sourceUri = normalizePlaybackUri(uri);
      const active = createAudioPlayer({ uri: sourceUri }, { updateInterval: 200 });
      playerRef.current = active;
      active.addListener('playbackStatusUpdate', (status) => {
        if (status.error) {
          setPlaying(false);
          onActiveChange(null);
          return;
        }
        if (status.didJustFinish) {
          setPlaying(false);
          onActiveChange(null);
        } else {
          setPlaying(status.playing);
        }
      });
      active.volume = Math.max(0.05, getOutputVolume());
      active.play();
      setPlaying(true);
    } catch (e) {
      releasePlayer();
      setPlaying(false);
      onActiveChange(null);
      Alert.alert('无法播放', e instanceof Error ? e.message : '请检查录音文件后重试');
    }
  };

  return (
    <Pressable onPress={toggle} style={[styles.btn, playing && styles.btnOn]}>
      <Text style={[styles.text, playing && styles.textOn]}>{playing ? '暂停' : '播放'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  btnOn: {
    backgroundColor: colors.gold,
  },
  text: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  textOn: {
    color: colors.bg,
  },
  na: {
    color: colors.dim,
    fontSize: 12,
  },
});
