from pathlib import Path

p = Path("apps/mobile/app/(tabs)/explore.tsx")
text = p.read_text()

old = """            <View style={s.tileTopRow}>\n              {distance != null ? <Text style={s.distanceBadge}>⌖ {distance.toFixed(0)} mi</Text> : <View />}\n              <Pressable\n"""
new = """            <View style={s.tileTopRow}>\n              <View style={s.tileBadges}>\n                {adventure.is_demo ? <Text style={s.demoBadge}>DEMO</Text> : null}\n                {distance != null ? <Text style={s.distanceBadge}>⌖ {distance.toFixed(0)} mi</Text> : null}\n              </View>\n              <Pressable\n"""
if old not in text:
    raise SystemExit("AdventureTile badge anchor not found")
text = text.replace(old, new, 1)

style_anchor = "  tileTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },\n"
style_insert = """  tileTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },\n  tileBadges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },\n  demoBadge: { color: '#111816', backgroundColor: '#F5C542', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, fontSize: 9, fontWeight: '900', letterSpacing: .7 },\n"""
if style_anchor not in text:
    raise SystemExit("AdventureTile style anchor not found")
text = text.replace(style_anchor, style_insert, 1)

p.write_text(text)
