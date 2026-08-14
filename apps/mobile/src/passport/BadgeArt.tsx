import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, Rect, Stop, Text as SvgText } from 'react-native-svg';

export type BadgeArtName =
  | 'First Adventure'
  | 'Trail Regular'
  | 'Wayfinder Five'
  | 'Summit Ten'
  | 'Legacy Twenty'
  | 'Camp Crew'
  | 'Water Wayfinder';

const supported = new Set<BadgeArtName>([
  'First Adventure',
  'Trail Regular',
  'Wayfinder Five',
  'Summit Ten',
  'Legacy Twenty',
  'Camp Crew',
  'Water Wayfinder',
]);

export function hasBadgeArt(title: string): title is BadgeArtName {
  return supported.has(title as BadgeArtName);
}

type Props = { title: BadgeArtName; size?: number };

const GOLD = '#D9B353';
const THREAD = '#F5E3B5';
const GREEN = '#0E4A36';
const DEEP = '#0B201A';

function Frame({ label, accent = GREEN }: { label: string; accent?: string }) {
  return (
    <>
      <Path d="M32 10 H168 Q188 10 194 30 L196 54 V154 Q194 178 168 190 H32 Q6 178 4 154 V54 L6 30 Q12 10 32 10 Z" fill={DEEP} stroke={GOLD} strokeWidth="8" />
      <Path d="M31 21 H169 Q178 21 183 36 V149 Q180 166 162 177 H38 Q20 166 17 149 V36 Q22 21 31 21 Z" fill={accent} stroke="#8A6A2B" strokeWidth="2" />
      <Path d="M35 31 H165 Q174 31 177 44 V137 Q174 151 158 159 H42 Q26 151 23 137 V44 Q26 31 35 31 Z" fill="#132C24" stroke={GOLD} strokeWidth="2" />
      <Path d="M25 135 Q100 151 175 135 V159 Q100 177 25 159 Z" fill={accent} stroke={GOLD} strokeWidth="3" />
      <SvgText x="100" y="157" textAnchor="middle" fill={THREAD} fontSize="14" fontWeight="900" letterSpacing="1">{label.toUpperCase()}</SvgText>
    </>
  );
}

function Mountains({ sun = '#EFB44A' }: { sun?: string }) {
  return (
    <G>
      <Circle cx="146" cy="67" r="16" fill={sun} />
      <Polygon points="31,123 72,76 102,122" fill="#31473B" stroke={THREAD} strokeWidth="1.5" />
      <Polygon points="65,122 111,67 161,124" fill="#22372E" stroke={THREAD} strokeWidth="1.5" />
      <Polygon points="99,122 145,83 176,124" fill="#405348" stroke={THREAD} strokeWidth="1.5" />
      <Path d="M25 126 Q67 111 100 125 T176 126 V137 Q100 145 25 137 Z" fill="#0B4A31" />
    </G>
  );
}

function FirstAdventure() {
  return (
    <Svg viewBox="0 0 200 200">
      <Defs><LinearGradient id="fa" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#174F3A" /><Stop offset="1" stopColor="#0E392C" /></LinearGradient></Defs>
      <Frame label="First Adventure" accent="url(#fa)" />
      <Mountains sun="#F6A93A" />
      <Circle cx="81" cy="73" r="8" fill="#5B321F" />
      <Path d="M74 82 Q82 77 90 84 L98 112 L87 117 L79 102 L70 123 L61 118 L70 92 Z" fill="#D7C29A" stroke="#1D1611" strokeWidth="2" />
      <Path d="M66 84 Q74 77 82 82 L76 106 L60 101 Z" fill="#526B3B" stroke="#1D1611" strokeWidth="2" />
      <Path d="M79 64 Q87 65 91 70 Q84 65 78 69 Z" fill="#1F1714" />
      <Circle cx="78" cy="65" r="4" fill="#1F1714" />
      <Path d="M68 119 L58 136 M84 115 L91 136" stroke="#4B3829" strokeWidth="7" strokeLinecap="round" />
      <Path d="M57 136 H69 M87 136 H99" stroke="#B57A3D" strokeWidth="5" strokeLinecap="round" />
    </Svg>
  );
}

function TrailRegular() {
  return (
    <Svg viewBox="0 0 200 200">
      <Frame label="Trail Regular" accent="#315C35" />
      <Mountains />
      <Path d="M44 111 Q68 105 83 113 Q99 122 117 108" fill="none" stroke="#E4C17B" strokeWidth="6" strokeLinecap="round" />
      <Path d="M53 75 Q61 63 75 66 L98 93 Q102 100 96 110 L77 121 Q67 125 61 116 L45 94 Q40 86 53 75 Z" fill="#8B5A2B" stroke={THREAD} strokeWidth="3" />
      <Path d="M56 80 L82 105 M63 73 L89 98" stroke="#D7B45A" strokeWidth="2" />
      <Path d="M47 94 Q73 98 96 110" stroke="#3D2A1D" strokeWidth="5" />
    </Svg>
  );
}

function WayfinderFive() {
  return (
    <Svg viewBox="0 0 200 200">
      <Frame label="Wayfinder Five" accent="#0B5260" />
      <Mountains sun="#E5A83E" />
      <Circle cx="100" cy="91" r="39" fill="#0F5560" stroke={GOLD} strokeWidth="4" />
      <Circle cx="100" cy="91" r="31" fill="#153C3D" stroke="#92B7A8" strokeWidth="2" />
      <Polygon points="100,57 109,83 135,91 109,99 100,125 91,99 65,91 91,83" fill={GOLD} stroke={THREAD} strokeWidth="2" />
      <Circle cx="100" cy="91" r="7" fill="#153C3D" stroke={THREAD} strokeWidth="2" />
      <Circle cx="100" cy="128" r="14" fill="#0D3F45" stroke={GOLD} strokeWidth="3" />
      <SvgText x="100" y="134" textAnchor="middle" fill={THREAD} fontSize="17" fontWeight="900">5</SvgText>
    </Svg>
  );
}

function SummitTen() {
  return (
    <Svg viewBox="0 0 200 200">
      <Frame label="Summit Ten" accent="#84501D" />
      <Circle cx="144" cy="66" r="18" fill="#F5B844" />
      <Polygon points="28,130 92,55 128,130" fill="#2B3734" stroke={THREAD} strokeWidth="2" />
      <Polygon points="64,130 126,70 177,130" fill="#3A413B" stroke={THREAD} strokeWidth="2" />
      <Polygon points="81,68 92,55 103,74 94,70 88,78" fill="#F1ECE0" />
      <Circle cx="100" cy="128" r="15" fill="#4B2E17" stroke={GOLD} strokeWidth="3" />
      <SvgText x="100" y="134" textAnchor="middle" fill={THREAD} fontSize="16" fontWeight="900">10</SvgText>
    </Svg>
  );
}

function LegacyTwenty() {
  return (
    <Svg viewBox="0 0 200 200">
      <Frame label="Legacy Twenty" accent="#6B211D" />
      <Circle cx="146" cy="69" r="16" fill="#E79443" />
      <Path d="M100 63 C76 54 52 70 50 88 C64 83 75 85 83 92 C70 96 61 105 59 115 C75 111 86 110 95 116 C97 128 100 134 100 134 C103 121 105 112 105 98 C117 103 130 100 144 88 C129 86 119 82 112 75 C126 76 138 71 147 62 C126 58 111 59 100 63 Z" fill="#355C32" stroke={GOLD} strokeWidth="2" />
      <Path d="M97 84 C98 102 96 115 86 133 M103 84 C103 104 106 116 115 133 M100 105 C91 111 84 119 78 132 M102 107 C111 112 119 120 125 132" stroke="#7D4B29" strokeWidth="5" strokeLinecap="round" />
      <Circle cx="100" cy="130" r="15" fill="#4B2A22" stroke={GOLD} strokeWidth="3" />
      <SvgText x="100" y="136" textAnchor="middle" fill={THREAD} fontSize="16" fontWeight="900">20</SvgText>
    </Svg>
  );
}

function CampCrew() {
  const people = [
    { x: 58, skin: '#5A2F1F', shirt: '#A85824' },
    { x: 85, skin: '#70402B', shirt: '#315F4C' },
    { x: 118, skin: '#4B291D', shirt: '#E0D4BC' },
    { x: 145, skin: '#6A3824', shirt: '#9A4C2C' },
  ];
  return (
    <Svg viewBox="0 0 200 200">
      <Frame label="Camp Crew" accent="#0D5448" />
      <Circle cx="143" cy="57" r="11" fill="#EBCB70" />
      <Polygon points="76,126 100,84 127,126" fill="#C98542" stroke={THREAD} strokeWidth="2" />
      <Path d="M91 126 L100 84 L109 126" stroke="#59371E" strokeWidth="2" />
      <Path d="M92 128 Q100 106 108 128" fill="#ED7425" stroke="#F4C056" strokeWidth="2" />
      {people.map((p, i) => <G key={i}><Circle cx={p.x} cy="104" r="6" fill={p.skin} /><Path d={`M${p.x-8} 111 Q${p.x} 105 ${p.x+8} 111 L${p.x+7} 128 H${p.x-7} Z`} fill={p.shirt} stroke="#241B16" strokeWidth="1.5" /></G>)}
      <Path d="M25 132 Q100 142 175 132" stroke="#73552D" strokeWidth="3" />
    </Svg>
  );
}

function WaterWayfinder() {
  return (
    <Svg viewBox="0 0 200 200">
      <Frame label="Water Wayfinder" accent="#0E5B72" />
      <Circle cx="148" cy="66" r="14" fill="#EBAE3C" />
      <Path d="M25 111 Q45 99 65 111 T105 111 T145 111 T177 111 V138 H25 Z" fill="#167B8C" />
      <Path d="M25 120 Q45 108 65 120 T105 120 T145 120 T177 120" fill="none" stroke="#8ED0CF" strokeWidth="3" />
      <Path d="M61 119 Q100 135 139 119 Q126 140 100 143 Q75 140 61 119 Z" fill="#D98A25" stroke="#432A18" strokeWidth="2" />
      <Circle cx="99" cy="91" r="7" fill="#4B291C" />
      <Path d="M96 98 L87 116 M102 98 L111 116" stroke="#4B291C" strokeWidth="7" strokeLinecap="round" />
      <Path d="M83 88 Q98 78 112 89" fill="none" stroke="#211918" strokeWidth="4" />
      <Path d="M76 79 L122 124" stroke="#E7B54D" strokeWidth="3" strokeLinecap="round" />
      <Path d="M70 73 L81 79 L76 84 Z M123 122 L134 128 L126 133 Z" fill="#E7B54D" />
      <Path d="M89 83 Q97 75 105 82 Q99 76 91 88" fill="#1B1715" />
    </Svg>
  );
}

export function BadgeArt({ title, size = 132 }: Props) {
  const props = { width: size, height: size };
  if (title === 'First Adventure') return <GWrap {...props}><FirstAdventure /></GWrap>;
  if (title === 'Trail Regular') return <GWrap {...props}><TrailRegular /></GWrap>;
  if (title === 'Wayfinder Five') return <GWrap {...props}><WayfinderFive /></GWrap>;
  if (title === 'Summit Ten') return <GWrap {...props}><SummitTen /></GWrap>;
  if (title === 'Legacy Twenty') return <GWrap {...props}><LegacyTwenty /></GWrap>;
  if (title === 'Camp Crew') return <GWrap {...props}><CampCrew /></GWrap>;
  return <GWrap {...props}><WaterWayfinder /></GWrap>;
}

function GWrap({ children, width, height }: { children: React.ReactNode; width: number; height: number }) {
  return <Svg width={width} height={height} viewBox="0 0 200 200">{children}</Svg>;
}
