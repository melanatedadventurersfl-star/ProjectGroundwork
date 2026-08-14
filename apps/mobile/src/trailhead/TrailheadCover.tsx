import { router } from 'expo-router';
import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { RankEmblem, type RankName } from '../passport/RankEmblem';
import { AppIcon } from '../ui/AppIcon';

function DefaultScenery() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 1000 360" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#496A78" />
          <Stop offset="0.42" stopColor="#E0A06A" />
          <Stop offset="0.66" stopColor="#8B684C" />
          <Stop offset="1" stopColor="#243D35" />
        </LinearGradient>
        <LinearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#456C68" />
          <Stop offset="1" stopColor="#102922" />
        </LinearGradient>
      </Defs>
      <Rect width="1000" height="360" fill="url(#sky)" />
      <Circle cx="760" cy="112" r="48" fill="#F3C879" opacity="0.9" />
      <Path d="M0 255 L122 186 L215 222 L340 105 L454 225 L555 151 L651 214 L782 113 L1000 235 L1000 360 L0 360 Z" fill="#456158" />
      <Path d="M255 186 L340 105 L400 183 L364 164 L341 129 L317 165 Z" fill="#DCE3DA" opacity="0.9" />
      <Path d="M700 183 L782 113 L846 190 L810 170 L783 138 L758 171 Z" fill="#DCE3DA" opacity="0.82" />
      <Path d="M0 286 L170 211 L276 258 L418 173 L555 269 L690 194 L842 270 L1000 197 L1000 360 L0 360 Z" fill="#1C342D" />
      <Rect y="282" width="1000" height="78" fill="url(#water)" />
      <Path d="M0 300 C155 282 315 321 480 299 C650 278 820 314 1000 292 L1000 360 L0 360 Z" fill="#17352E" opacity="0.76" />
      <Path d="M44 286 l26 -76 26 76z M82 286 l18 -55 19 55z M887 286 l31 -91 31 91z M844 286 l22 -66 23 66z M151 286 l17 -48 17 48z" fill="#0B221B" />
    </Svg>
  );
}

export function TrailheadCover({
  coverUrl,
  displayName,
  rank,
  greeting,
  busy = false,
  onEdit,
  onRankPress,
}: {
  coverUrl?: string | null;
  displayName: string;
  rank: RankName;
  greeting: string;
  busy?: boolean;
  onEdit: () => void;
  onRankPress: () => void;
}) {
  const content = (
    <>
      {!coverUrl ? <DefaultScenery /> : null}
      <View style={styles.scrim} />

      <View style={styles.headerRow}>
        <ImageBackground
          source={require('../../assets/ma-pathfinder-mark.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Melanated Adventurers"
        />
        <View style={styles.headerActions}>
          <Pressable accessibilityLabel="Notifications" onPress={() => router.push('/notifications')} style={styles.headerButton}>
            <AppIcon name="notifications" color="#FFF8E8" size={18} />
          </Pressable>
          <Pressable accessibilityLabel="Profile" onPress={() => router.push('/member/profile')} style={styles.headerButton}>
            <AppIcon name="profile" color="#FFF8E8" size={18} />
          </Pressable>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={coverUrl ? 'Change Trailhead cover photo' : 'Add Trailhead cover photo'}
        hitSlop={8}
        onPress={onEdit}
        disabled={busy}
        style={styles.editButton}
      >
        {busy ? <ActivityIndicator color="#FFF8E8" size="small" /> : <AppIcon name="camera" color="#FFF8E8" size={13} />}
      </Pressable>

      <View style={styles.identity}>
        <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{greeting}, {displayName}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${rank} rank progress`} onPress={onRankPress} style={styles.rankChip}>
          <RankEmblem rank={rank} size={25} />
          <Text style={styles.rankText}>{rank.toUpperCase()}</Text>
        </Pressable>
      </View>
    </>
  );

  if (coverUrl) {
    return (
      <ImageBackground source={{ uri: coverUrl }} style={styles.cover} imageStyle={styles.imageRadius} resizeMode="cover">
        {content}
      </ImageBackground>
    );
  }

  return <View style={styles.cover}>{content}</View>;
}

const styles = StyleSheet.create({
  cover: {
    height: 156,
    marginTop: -72,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#263B34',
    justifyContent: 'flex-end',
  },
  imageRadius: { borderRadius: 18 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,10,8,0.23)' },
  headerRow: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { width: 44, height: 44 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(9,17,13,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,248,232,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    position: 'absolute',
    top: 57,
    right: 12,
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: 'rgba(10,18,14,0.64)',
    borderWidth: 1,
    borderColor: 'rgba(255,248,232,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { paddingHorizontal: 14, paddingBottom: 12, gap: 5 },
  greeting: {
    color: '#FFF8E8',
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '900',
    paddingRight: 36,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  rankChip: {
    alignSelf: 'flex-start',
    minHeight: 31,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingLeft: 3,
    paddingRight: 10,
    paddingVertical: 2,
    backgroundColor: 'rgba(10,18,14,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(215,180,90,0.58)',
  },
  rankText: { color: '#FFF8E8', fontSize: 10, fontWeight: '900', letterSpacing: 1.05 },
});
