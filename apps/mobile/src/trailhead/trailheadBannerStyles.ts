import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  cover: { height: 212, marginTop: -72, borderRadius: 22, overflow: 'hidden', backgroundColor: '#07100D', borderWidth: 1.4, shadowOpacity: 0.32, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  coverCompact: { height: 198 },
  imageRadius: { borderRadius: 22 },
  baseScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,7,6,0.10)' },
  rankGlow: { position: 'absolute', left: -64, top: -42, width: 260, height: 260, borderRadius: 130 },
  leftScrim: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '62%', backgroundColor: 'rgba(3,8,6,0.48)' },
  leftScrimCompact: { width: '78%' },
  bottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 76, backgroundColor: 'rgba(2,6,5,0.44)' },
  primaryEmblem: { position: 'absolute', left: 10, top: 20, width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  primaryEmblemCompact: { left: 8, top: 22, width: 84, height: 84 },
  headerActions: { position: 'absolute', right: 12, top: 11, flexDirection: 'row', gap: 8, zIndex: 5 },
  headerButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(5,10,9,0.72)', borderWidth: 1, borderColor: 'rgba(255,248,232,0.28)', alignItems: 'center', justifyContent: 'center' },
  titleBlock: { position: 'absolute', left: 126, right: 98, top: 27 }, titleBlockCompact: { left: 98, right: 12, top: 28 }, titleBlockVeryCompact: { left: 94, right: 10 },
  greeting: { color: '#FFF8E8', fontSize: 15, lineHeight: 19, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.82)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } }, greetingCompact: { fontSize: 14, lineHeight: 17 },
  name: { color: '#FFFDF5', fontSize: 29, lineHeight: 34, fontWeight: '900', marginTop: 1, textShadowColor: 'rgba(0,0,0,0.88)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } }, nameCompact: { fontSize: 25, lineHeight: 30 },
  metaBlock: { position: 'absolute', left: 126, right: 98, bottom: 17 }, metaBlockCompact: { left: 12, right: 12, bottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'nowrap' }, rankInline: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }, rankGlyph: { fontSize: 13, fontWeight: '900' }, rankText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.35, flexShrink: 1 },
  dot: { color: 'rgba(255,248,232,0.7)', fontSize: 11, fontWeight: '900' }, statusIcon: { color: '#FFF8E8', fontSize: 12 }, statusText: { color: '#FFF8E8', fontSize: 11.5, fontWeight: '800' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }, location: { color: 'rgba(255,248,232,0.82)', fontSize: 10.5, fontWeight: '700', maxWidth: '42%' }, weatherCopy: { fontSize: 10.5, fontWeight: '800', flexShrink: 1 }, weatherCopyCompact: { fontSize: 10, fontWeight: '800', marginTop: 5 },
  secondaryRank: { position: 'absolute', right: 12, bottom: 12, width: 82, alignItems: 'center', gap: 4 }, rankPill: { minWidth: 74, maxWidth: 96, minHeight: 22, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, backgroundColor: 'rgba(4,9,7,0.74)', alignItems: 'center', justifyContent: 'center' }, rankPillText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.3 },
});
