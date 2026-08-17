import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  cover: { height: 224, marginTop: -72, borderRadius: 22, overflow: 'hidden', backgroundColor: '#07100D', borderWidth: 1.4, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  coverCompact: { height: 212 },
  imageRadius: { borderRadius: 22 },
  baseScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,6,0.08)' },
  rankGlow: { position: 'absolute', left: -72, top: -48, width: 250, height: 250, borderRadius: 125 },
  leftScrim: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '56%', backgroundColor: 'rgba(3,8,6,0.48)' },
  leftScrimCompact: { width: '70%' },
  bottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 92, backgroundColor: 'rgba(2,6,5,0.54)' },

  primaryEmblem: { position: 'absolute', left: 10, top: 26, width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  primaryEmblemCompact: { left: 8, top: 31, width: 80, height: 80 },

  headerActions: { position: 'absolute', right: 12, top: 11, flexDirection: 'row', gap: 8, zIndex: 5 },
  headerButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(5,10,9,0.58)', borderWidth: 1, borderColor: 'rgba(255,248,232,0.20)', alignItems: 'center', justifyContent: 'center' },

  titleBlock: { position: 'absolute', left: 112, right: 90, top: 30 },
  titleBlockCompact: { left: 94, right: 14, top: 31 },
  titleBlockVeryCompact: { left: 90, right: 10 },
  greeting: { color: '#FFF8E8', fontSize: 15, lineHeight: 19, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.82)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  greetingCompact: { fontSize: 14, lineHeight: 17 },
  name: { color: '#FFFDF5', fontSize: 28, lineHeight: 33, fontWeight: '900', marginTop: 1, textShadowColor: 'rgba(0,0,0,0.88)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  nameCompact: { fontSize: 24, lineHeight: 29 },
  rankInline: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7, paddingVertical: 2 },
  rankGlyph: { fontSize: 12, fontWeight: '900' },
  rankText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.55 },

  metaBlock: { position: 'absolute', left: 16, right: 16, bottom: 15 },
  metaBlockCompact: { left: 12, right: 12, bottom: 12 },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
  weatherIcon: { color: '#FFF8E8', fontSize: 13 },
  weatherText: { color: '#FFF8E8', fontSize: 11.5, fontWeight: '800', textTransform: 'capitalize' },
  weatherDivider: { color: 'rgba(255,248,232,0.62)', fontSize: 11, fontWeight: '900' },
  location: { color: 'rgba(255,248,232,0.84)', fontSize: 10.5, fontWeight: '700', flexShrink: 1 },
  weatherCopy: { fontSize: 10.5, lineHeight: 14, fontWeight: '800', marginTop: 7, maxWidth: '78%' },
});
