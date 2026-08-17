import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  cover: { height: 224, marginTop: -72, borderRadius: 22, overflow: 'hidden', backgroundColor: '#07100D', borderWidth: 1.4, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  coverCompact: { height: 212 },
  imageRadius: { borderRadius: 22 },
  baseScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,6,0.01)' },
  rankGlow: { position: 'absolute', left: -72, top: -48, width: 250, height: 250, borderRadius: 125, opacity: 0.34 },
  leftScrim: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 0, backgroundColor: 'transparent' },
  leftScrimCompact: { width: 0 },
  bottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 74, backgroundColor: 'rgba(2,6,5,0.16)' },

  primaryEmblem: { position: 'absolute', left: 10, top: 26, width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  primaryEmblemCompact: { left: 8, top: 31, width: 80, height: 80 },

  headerActions: { position: 'absolute', right: 12, top: 11, flexDirection: 'row', gap: 8, zIndex: 5 },
  headerButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(5,10,9,0.42)', borderWidth: 1, borderColor: 'rgba(255,248,232,0.20)', alignItems: 'center', justifyContent: 'center' },

  titleBlock: { position: 'absolute', left: 112, right: 90, top: 30 },
  titleBlockCompact: { left: 94, right: 14, top: 31 },
  titleBlockVeryCompact: { left: 90, right: 10 },
  greeting: { color: '#FFF8E8', fontSize: 15, lineHeight: 19, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.96)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } },
  greetingCompact: { fontSize: 14, lineHeight: 17 },
  name: { color: '#FFFDF5', fontSize: 28, lineHeight: 33, fontWeight: '900', marginTop: 1, textShadowColor: 'rgba(0,0,0,0.98)', textShadowRadius: 9, textShadowOffset: { width: 0, height: 2 } },
  nameCompact: { fontSize: 24, lineHeight: 29 },
  rankInline: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7, paddingVertical: 2 },
  rankGlyph: { fontSize: 12, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  rankText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.55, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },

  metaBlock: { position: 'absolute', left: 16, right: 16, bottom: 15 },
  metaBlockCompact: { left: 12, right: 12, bottom: 12 },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
  weatherIcon: { color: '#FFF8E8', fontSize: 13, textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  weatherText: { color: '#FFF8E8', fontSize: 11.5, fontWeight: '800', textTransform: 'capitalize', textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  weatherDivider: { color: 'rgba(255,248,232,0.82)', fontSize: 11, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  location: { color: '#FFF8E8', fontSize: 10.5, fontWeight: '700', flexShrink: 1, textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  weatherCopy: { fontSize: 10.5, lineHeight: 14, fontWeight: '800', marginTop: 7, maxWidth: '78%', textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
});
