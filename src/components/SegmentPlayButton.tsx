import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { enterPlaybackAudioMode, getOutputVolume } from '../audio/audioMode';
import { colors, radius } from '../theme';

type Props = {
  uri?: string;
  /** Currently allowed playing uri; only this one may play. */
  activeUri: string | null;
  onActiveChange: (uri: string | null) => void;
};

export function SegmentPlayButton({ uri, activeUri, onActiveChange }: Props) {
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    return () => {
      try {
        playerRef.current?.pause();
        playerRef.current?.remove();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
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

      await enterPlaybackAudioMode();

      let active = playerRef.current;
      if (!active) {
        active = createAudioPlayer({ uri }, { updateInterval: 200 });
        playerRef.current = active;
        active.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) {
            setPlaying(false);
            onActiveChange(null);
          } else {
            setPlaying(status.playing);
          }
        });
      } else {
        await active.seekTo(0);
      }
      active.volume = getOutputVolume();
      active.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      onActiveChange(null);
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
