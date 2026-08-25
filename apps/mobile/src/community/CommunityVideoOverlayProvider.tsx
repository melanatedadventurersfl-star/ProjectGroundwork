import Ionicons from '@react-native-vector-icons/ionicons';
import { type PropsWithChildren, useEffect, useState } from 'react';
import { Linking, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { CommunityVideoPlayer } from './CommunityVideoPlayer';

function isCommunityVideoUrl(url: string) {
  if (!url.includes('/community-media/')) return false;
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  return /\.(mp4|mov|m4v|webm)$/.test(path);
}

export function CommunityVideoOverlayProvider({ children }: PropsWithChildren) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    const originalOpenUrl = Linking.openURL.bind(Linking);

    Linking.openURL = async (url: string) => {
      if (isCommunityVideoUrl(url)) {
        setVideoUrl(url);
        return;
      }
      return originalOpenUrl(url);
    };

    return () => {
      Linking.openURL = originalOpenUrl;
    };
  }, []);

  return (
    <>
      {children}
      <Modal
        visible={Boolean(videoUrl)}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setVideoUrl(null)}
      >
        <SafeAreaView style={styles.screen}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>CAMPFIRE VIDEO</Text>
              <Text style={styles.title}>Now playing</Text>
            </View>
            <Pressable
              style={styles.closeButton}
              onPress={() => setVideoUrl(null)}
              accessibilityRole="button"
              accessibilityLabel="Close video"
            >
              <Ionicons name="close" size={24} color="#FFF8E8" />
            </Pressable>
          </View>

          <View style={styles.playerArea}>
            {videoUrl ? <CommunityVideoPlayer uri={videoUrl} /> : null}
          </View>

          <Text style={styles.helper}>Use the player controls to seek, mute, or enter fullscreen.</Text>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#080D0B',
    paddingHorizontal: 16,
  },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#D7B45A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#FFF8E8', fontSize: 22, fontWeight: '900', marginTop: 2 },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17211C',
    borderWidth: 1,
    borderColor: '#34483D',
  },
  playerArea: {
    flex: 1,
    justifyContent: 'center',
  },
  helper: {
    color: '#8F9B93',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
