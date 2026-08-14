import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { RankEmblem, type RankName } from '../passport/RankEmblem';
import { AppIcon } from '../ui/AppIcon';

function DefaultScenery() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 1000 320" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFillObject}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#607C7B" />
          <Stop offset="0.55" stopColor="#A49775" />
          <Stop offset="1" stopColor="#253B31" />
        </LinearGradient>
        <LinearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#33554E" />
          <Stop offset="1" stopColor="#10251F" />
        </LinearGradient>
      </Defs>
      <Rect width="1000" height="320" fill="url(#sky)" />
      <Circle cx="770" cy="78" r="43" fill="#E4C47A" opacity="0.72" />
      <Path d="M0 215 L170 108 L250 173 L390 56 L520 174 L650 86 L835 203 L1000 119 L1000 320 L0 320 Z" fill="#263B34" />
      <Path d="M0 240 L135 167 L260 224 L420 142 L580 226 L742 157 L880 222 L1000 183 L1000 320 L0 320 Z" fill="#182B25" />
      <Rect y="240" width="1000" height="80" fill="url(#water)" />
      <Path d="M0 251 C170 236 310 268 480 250 C655 231 796 263 1000 244 L1000 320 L0 320 Z" fill="#1A332C" opacity="0.8" />
      <Path d="M80 244 l24 -64 22 64z M116 244 l18 -48 16 48z M885 244 l29 -78 28 78z M842 244 l21 -59 21 59z" fill="#0E211B" />
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={coverUrl ? 'Change Trailhead cover photo' : 'Add Trailhead cover photo'}
        hitSlop={8}
        onPress={onEdit}
        disabled={busy}
        style={styles.editButton}
      >
        {busy ? <ActivityIndicator color="#FFF8E8" size="small" /> : <AppIcon name="camera" color="#FFF8E8" size={15} />}
      </Pressable>
      <View style={styles.identity}>
        <Text style={styles.greeting} numberOfLines={1}>{greeting}, {displayName}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${rank} rank progress`} onPress={onRankPress} style={styles.rankChip}>
          <RankEmblem rank={rank} size={30} />
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
  cover: { height: 142, borderRadius: 22, overflow: 'hidden', backgroundColor: '#263B34', justifyContent: 'flex-end' },
  imageRadius: { borderRadius: 22 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,8,0.34)' },
  editButton: { position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(10,18,14,0.72)', borderWidth: 1, borderColor: 'rgba(255,248,232,0.24)', alignItems: 'center', justifyContent: 'center' },
  identity: { padding: 14, gap: 7 },
  greeting: { color: '#FFF8E8', fontSize: 21, lineHeight: 25, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  rankChip: { alignSelf: 'flex-start', minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingLeft: 4, paddingRight: 12, paddingVertical: 3, backgroundColor: 'rgba(10,18,14,0.76)', borderWidth: 1, borderColor: 'rgba(215,180,90,0.52)' },
  rankText: { color: '#FFF8E8', fontSize: 11, fontWeight: '900', letterSpacing: 1.15 },
});
