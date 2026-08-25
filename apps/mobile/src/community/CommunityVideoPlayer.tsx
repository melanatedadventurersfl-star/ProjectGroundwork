import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = {
  uri: string;
  aspectRatio?: number;
};

export function CommunityVideoPlayer({ uri, aspectRatio = 16 / 9 }: Props) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // The hook owns player disposal; pause is only a best-effort guard on unmount.
      }
    };
  }, [player]);

  return (
    <Pressable
      style={[styles.shell, { aspectRatio }]}
      onPress={(event) => event.stopPropagation()}
      accessibilityLabel="Video player"
    >
      <View style={styles.clip}>
        <VideoView
          style={styles.video}
          player={player}
          nativeControls
          contentFit="contain"
          fullscreenOptions={{ enable: true }}
          surfaceType="textureView"
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    minHeight: 190,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#39473F',
    backgroundColor: '#080D0B',
    overflow: 'hidden',
  },
  clip: {
    flex: 1,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: '#080D0B',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#080D0B',
  },
});
