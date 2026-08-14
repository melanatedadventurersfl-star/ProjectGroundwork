import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, Rect, Stop, Text as SvgText } from 'react-native-svg';

export type PassportStampCode =
  | 'legacy-event-2025-group-launch'
  | 'legacy-event-2025-huguenot-camping'
  | 'legacy-event-2025-float-out'
  | 'legacy-event-2025-black-breezy'
  | 'legacy-event-2025-fire-dragon'
  | 'legacy-event-2025-wet-wild'
  | 'legacy-event-2026-beach-escape'
  | 'legacy-event-2026-float-out-juneteenth'
  | 'legacy-event-2026-champs'
  | 'legacy-event-2026-splash-after-dark'
  | 'event-2026-lake-louisa-trail-day'
  | 'event-2026-silver-springs-paddle-day'
  | 'event-2026-everglades-eco-day';

type StampFamily = 'postage-2025' | 'arched-2026';
type Motif = 'launch' | 'camp' | 'float' | 'breezy' | 'dragon' | 'waterpark' | 'beach' | 'juneteenth' | 'champs' | 'night' | 'trail' | 'paddle' | 'everglades';

type StampDefinition = {
  family: StampFamily;
  motif: Motif;
  kicker: string;
  title: string[];
  date: string[];
  location: string[];
  palette: { paper: string; ink: string; deep: string; warm: string; cool: string; glow: string };
};

const STAMPS: Record<PassportStampCode, StampDefinition> = {
  'legacy-event-2025-group-launch': { family: 'postage-2025', motif: 'launch', kicker: 'MA OFFICIAL', title: ['GROUP', 'LAUNCH'], date: ['MAR', '04', '2025'], location: ['JACKSONVILLE, FL'], palette: { paper: '#E9D9B4', ink: '#0E5A5B', deep: '#082D30', warm: '#D69A36', cool: '#77A6A0', glow: '#F3C85E' } },
  'legacy-event-2025-huguenot-camping': { family: 'postage-2025', motif: 'camp', kicker: 'HUGUENOT PARK', title: ['CAMPING TRIP'], date: ['MAR', '28–30', '2025'], location: ['HUGUENOT MEMORIAL PARK', 'JACKSONVILLE, FL'], palette: { paper: '#E4D4AA', ink: '#315837', deep: '#172B1B', warm: '#D9782E', cool: '#71845D', glow: '#E5AD4F' } },
  'legacy-event-2025-float-out': { family: 'postage-2025', motif: 'float', kicker: 'GREAT MELANATED', title: ['FLOAT-OUT'], date: ['APR', '26', '2025'], location: ['NORTH FLORIDA'], palette: { paper: '#E8D9B4', ink: '#0D6670', deep: '#083B42', warm: '#E27C35', cool: '#5D8B64', glow: '#E9B54A' } },
  'legacy-event-2025-black-breezy': { family: 'postage-2025', motif: 'breezy', kicker: 'BLACK & BREEZY', title: ['THE SUMMER', 'COOL-DOWN'], date: ['JUN', '20–22', '2025'], location: ['TOMOKA STATE PARK, FL'], palette: { paper: '#E1D2B5', ink: '#4D3966', deep: '#251B38', warm: '#D86E49', cool: '#72568A', glow: '#F0A05D' } },
  'legacy-event-2025-fire-dragon': { family: 'postage-2025', motif: 'dragon', kicker: 'GREAT MELANATED', title: ['FIRE DRAGON', 'CONQUEST'], date: ['JUL', '12', '2025'], location: ['JACKSONVILLE, FL'], palette: { paper: '#DCC79C', ink: '#7C2E1A', deep: '#260D09', warm: '#F26A22', cool: '#9A3020', glow: '#FFB333' } },
  'legacy-event-2025-wet-wild': { family: 'postage-2025', motif: 'waterpark', kicker: 'GREAT MELANATED', title: ['WET & WILD', 'ADVENTURE'], date: ['JUL', '18', '2025'], location: ['ORLANDO / KISSIMMEE, FL'], palette: { paper: '#E5D8B7', ink: '#106A76', deep: '#07373F', warm: '#E9B348', cool: '#67A59F', glow: '#F6D66D' } },
  'legacy-event-2026-beach-escape': { family: 'arched-2026', motif: 'beach', kicker: 'THE GREAT', title: ['MELANATED', 'BEACH ESCAPE'], date: ['MAR', '27–29', '2026'], location: ['HUGUENOT MEMORIAL PARK', 'JACKSONVILLE, FL'], palette: { paper: '#E9D9B4', ink: '#0C626A', deep: '#07333A', warm: '#E3A640', cool: '#63A7A8', glow: '#F1C862' } },
  'legacy-event-2026-float-out-juneteenth': { family: 'arched-2026', motif: 'juneteenth', kicker: 'THE GREAT MELANATED', title: ['FLOAT OUT', 'JUNETEENTH EDITION'], date: ['JUN', '20', '2026'], location: ['WILLIAM F. SHEFFIELD', 'REGIONAL PARK · JACKSONVILLE, FL'], palette: { paper: '#E4D5AF', ink: '#38532D', deep: '#172815', warm: '#C84A2F', cool: '#5E7D4B', glow: '#D7AF3E' } },
  'legacy-event-2026-champs': { family: 'arched-2026', motif: 'champs', kicker: 'MELANATED ADVENTURES', title: ['C.H.A.M.P.s', 'SUMMER SESSION'], date: ['JUL', '23', '2026'], location: ['JACKSONVILLE AREA'], palette: { paper: '#DFCFAA', ink: '#7B3818', deep: '#35180B', warm: '#E46822', cool: '#536B36', glow: '#F2AA45' } },
  'legacy-event-2026-splash-after-dark': { family: 'arched-2026', motif: 'night', kicker: 'MELANATED ADVENTURERS', title: ['SPLASH', 'AFTER DARK'], date: ['JUL', '25', '2026'], location: ['ISLAND H2O', 'ORLANDO AREA'], palette: { paper: '#DDD0B7', ink: '#4B3769', deep: '#16122F', warm: '#A66BD0', cool: '#407DA8', glow: '#C4B2FF' } },
  'event-2026-lake-louisa-trail-day': { family: 'arched-2026', motif: 'trail', kicker: 'MELANATED ADVENTURERS', title: ['LAKE LOUISA', 'TRAIL DAY'], date: ['JUL', '2026'], location: ['LAKE LOUISA STATE PARK', 'CLERMONT, FL'], palette: { paper: '#E4D8B7', ink: '#4B6339', deep: '#21321B', warm: '#C89543', cool: '#668590', glow: '#E6BE65' } },
  'event-2026-silver-springs-paddle-day': { family: 'arched-2026', motif: 'paddle', kicker: 'MELANATED ADVENTURERS', title: ['SILVER SPRINGS', 'PADDLE DAY'], date: ['AUG', '2026'], location: ['SILVER SPRINGS STATE PARK', 'SILVER SPRINGS, FL'], palette: { paper: '#E5DAB9', ink: '#21707A', deep: '#0D3B41', warm: '#DDB45B', cool: '#4BA9A0', glow: '#BFE3D1' } },
  'event-2026-everglades-eco-day': { family: 'arched-2026', motif: 'everglades', kicker: 'MELANATED ADVENTURERS', title: ['EVERGLADES', 'ECO DAY'], date: ['AUG', '2026'], location: ['EVERGLADES NATIONAL PARK', 'HOMESTEAD, FL'], palette: { paper: '#E1D4AD', ink: '#4D6240', deep: '#24321F', warm: '#D5903D', cool: '#527D78', glow: '#E8B55A' } },
};

export function isLegacyStampCode(code: string | null | undefined): code is PassportStampCode {
  return !!code && code in STAMPS;
}

function PaperTexture({ color, height }: { color: string; height: number }) {
  const dots: readonly [number, number, number][] = [
    [26, 34, 1.4], [47, 61, 1], [78, 43, 1.3], [109, 76, 1], [143, 49, 1.6], [164, 92, 1],
    [34, 122, 1.2], [66, 146, 1.5], [96, 119, 1], [129, 158, 1.3], [157, 142, 1], [42, 189, 1.5],
    [76, 213, 1], [116, 198, 1.4], [151, 226, 1.3], [54, 254, 1], [94, 278, 1.4], [139, 266, 1],
  ];
  return <G opacity={0.22}>{dots.filter(([, y]) => y < height - 8).map(([x, y, r], i) => <Circle key={i} cx={x} cy={y} r={r} fill={color} />)}</G>;
}

function Pine({ x, y, scale, color }: { x: number; y: number; scale: number; color: string }) {
  return <G transform={`translate(${x} ${y}) scale(${scale})`}><Rect x={-1.5} y={22} width={3} height={15} fill={color} /><Polygon points="0,0 -13,24 13,24" fill={color} /><Polygon points="0,9 -16,31 16,31" fill={color} /></G>;
}

function Palm({ x, y, scale, color }: { x: number; y: number; scale: number; color: string }) {
  return <G transform={`translate(${x} ${y}) scale(${scale})`}><Path d="M0 42 C2 28 5 15 10 0" stroke={color} strokeWidth={4} fill="none" /><Path d="M10 1 C-5 -8 -19 -4 -28 3 M10 1 C-4 7 -13 14 -24 20 M10 1 C23 -8 38 -7 48 -1 M10 1 C24 4 36 12 45 21" stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" /></G>;
}

function Person({ x, y, scale = 1, color }: { x: number; y: number; scale?: number; color: string }) {
  return <G transform={`translate(${x} ${y}) scale(${scale})`} fill={color}><Circle cx={0} cy={0} r={4.7} /><Path d="M-6 8 Q0 3 6 8 L8 27 L-8 27 Z" /></G>;
}

function Tube({ x, y, scale, color, accent }: { x: number; y: number; scale: number; color: string; accent: string }) {
  return <G transform={`translate(${x} ${y}) scale(${scale})`}><Circle cx={0} cy={0} r={15} fill={accent} stroke={color} strokeWidth={3.6} /><Circle cx={0} cy={0} r={7} fill="none" stroke={color} strokeWidth={2} /><Circle cx={0} cy={-11} r={4} fill={color} /></G>;
}

function Tent({ x, y, scale, fill, stroke }: { x: number; y: number; scale: number; fill: string; stroke: string }) {
  return <G transform={`translate(${x} ${y}) scale(${scale})`}><Path d="M0 42 L29 0 L59 42 Z" fill={fill} stroke={stroke} strokeWidth={3} /><Path d="M29 0 L29 42" stroke={stroke} strokeWidth={2} /><Path d="M29 42 L43 23 L59 42" fill={stroke} opacity={0.5} /></G>;
}

function Campfire({ x, y, scale, warm, glow, deep }: { x: number; y: number; scale: number; warm: string; glow: string; deep: string }) {
  return <G transform={`translate(${x} ${y}) scale(${scale})`}><Path d="M0 28 L26 40 M26 28 L0 40" stroke={deep} strokeWidth={4} strokeLinecap="round" /><Path d="M13 31 C1 23 8 13 11 4 C17 12 24 17 20 27 C25 21 25 15 22 10 C34 20 29 33 17 37 Z" fill={warm} /><Path d="M14 29 C10 23 14 18 15 14 C20 19 21 24 18 30 Z" fill={glow} /></G>;
}

function Waves({ y, color, accent }: { y: number; color: string; accent: string }) {
  return <G><Path d={`M20 ${y} C42 ${y - 8} 57 ${y + 8} 79 ${y} S116 ${y - 8} 138 ${y} S158 ${y + 6} 172 ${y}`} stroke={color} strokeWidth={2.2} fill="none" /><Path d={`M20 ${y + 12} C42 ${y + 4} 57 ${y + 20} 79 ${y + 12} S116 ${y + 4} 138 ${y + 12} S158 ${y + 18} 172 ${y + 12}`} stroke={accent} strokeWidth={2} fill="none" opacity={0.9} /></G>;
}

function Scene({ stamp }: { stamp: StampDefinition }) {
  const p = stamp.palette;
  switch (stamp.motif) {
    case 'launch':
      return <G><Circle cx={95} cy={116} r={29} fill={p.glow} opacity={0.9} /><G fill={p.deep}><Rect x={25} y={127} width={16} height={49} /><Rect x={44} y={115} width={18} height={61} /><Rect x={66} y={133} width={19} height={43} /><Rect x={89} y={101} width={22} height={75} /><Rect x={115} y={121} width={17} height={55} /><Rect x={136} y={110} width={22} height={66} /></G><Path d="M21 178 C51 167 78 176 106 169 S143 170 171 160" stroke={p.ink} strokeWidth={3} fill="none" /><Person x={53} y={177} scale={0.7} color={p.deep} /><Person x={78} y={176} scale={0.78} color={p.deep} /><Person x={105} y={177} scale={0.72} color={p.deep} /><Person x={131} y={176} scale={0.78} color={p.deep} /></G>;
    case 'camp':
      return <G><Path d="M18 149 C43 126 66 131 90 115 C119 96 145 113 173 94 L173 191 L18 191 Z" fill={p.cool} opacity={0.62} /><Palm x={38} y={106} scale={0.62} color={p.deep} /><Palm x={142} y={105} scale={0.7} color={p.deep} /><Tent x={45} y={142} scale={0.88} fill={p.warm} stroke={p.deep} /><Campfire x={117} y={149} scale={0.7} warm={p.warm} glow={p.glow} deep={p.deep} /><Person x={126} y={174} scale={0.52} color={p.deep} /><Person x={146} y={175} scale={0.48} color={p.deep} /><Waves y={133} color={p.ink} accent={p.cool} /></G>;
    case 'float':
    case 'juneteenth':
      return <G><Circle cx={96} cy={114} r={22} fill={p.glow} /><Path d="M18 132 C45 112 66 128 88 116 C116 102 138 116 173 104" stroke={p.deep} strokeWidth={5} fill="none" opacity={0.68} /><Waves y={142} color={p.ink} accent={p.cool} /><Tube x={50} y={170} scale={0.92} color={p.deep} accent={p.warm} /><Tube x={94} y={177} scale={0.92} color={p.deep} accent={p.glow} /><Tube x={138} y={168} scale={0.9} color={p.deep} accent={p.warm} />{stamp.motif === 'juneteenth' ? <G><Rect x={151} y={113} width={3} height={54} fill={p.deep} /><Path d="M154 114 L174 120 L154 130 Z" fill="#B43C2D" /><Path d="M154 130 L174 136 L154 146 Z" fill="#141414" /><Path d="M154 146 L174 152 L154 162 Z" fill="#2E6A39" /></G> : null}</G>;
    case 'breezy':
      return <G><Circle cx={105} cy={118} r={30} fill={p.warm} opacity={0.95} /><Path d="M18 151 C47 139 67 146 95 137 C121 129 145 136 174 125 L174 194 L18 194 Z" fill={p.cool} opacity={0.65} /><Palm x={36} y={111} scale={0.7} color={p.deep} /><Palm x={147} y={112} scale={0.6} color={p.deep} /><Path d="M43 171 Q93 194 146 166" stroke={p.deep} strokeWidth={4} fill="none" /><Path d="M43 171 L36 145 M146 166 L154 143" stroke={p.deep} strokeWidth={2.5} /><Person x={95} y={174} scale={0.5} color={p.deep} /></G>;
    case 'dragon':
      return <G><Rect x={18} y={96} width={156} height={98} fill={p.cool} opacity={0.32} /><Path d="M18 190 C26 156 48 128 77 128 C94 103 127 94 158 109 C141 111 132 121 133 134 C151 130 166 141 175 156 C151 151 132 158 117 176 C90 197 55 202 18 190 Z" fill={p.deep} /><Path d="M79 138 C63 125 50 112 42 94 C61 107 74 110 90 105" stroke={p.warm} strokeWidth={5} fill="none" /><Circle cx={137} cy={122} r={3} fill={p.glow} /><Path d="M103 191 C88 170 98 156 93 143 C114 154 121 173 110 191 C126 179 132 164 128 150 C151 168 143 192 116 201 Z" fill={p.warm} /><Path d="M116 188 C109 178 113 168 114 163 C124 171 125 181 120 190 Z" fill={p.glow} /><Person x={60} y={177} scale={0.75} color={p.paper} /><Path d="M57 158 L78 137" stroke={p.paper} strokeWidth={3} /></G>;
    case 'waterpark':
      return <G><Circle cx={143} cy={111} r={19} fill={p.glow} /><Path d="M28 181 C37 139 52 111 76 113 C104 115 111 141 91 153 C73 163 75 177 90 187" stroke={p.deep} strokeWidth={9} fill="none" strokeLinecap="round" /><Path d="M105 184 C111 145 129 124 164 112" stroke={p.warm} strokeWidth={8} fill="none" strokeLinecap="round" /><Rect x={28} y={119} width={4} height={68} fill={p.ink} /><Rect x={160} y={104} width={4} height={83} fill={p.ink} /><Waves y={183} color={p.ink} accent={p.cool} /><Tube x={123} y={184} scale={0.48} color={p.deep} accent={p.warm} /><Tube x={148} y={184} scale={0.42} color={p.deep} accent={p.glow} /></G>;
    case 'beach':
      return <G><Circle cx={98} cy={143} r={27} fill={p.glow} /><Waves y={166} color={p.ink} accent={p.cool} /><Palm x={38} y={125} scale={0.62} color={p.deep} /><Palm x={150} y={127} scale={0.56} color={p.deep} /><Path d="M38 215 L53 183 L68 215 M73 215 L88 183 L103 215" stroke={p.deep} strokeWidth={3.4} fill="none" /><Person x={55} y={193} scale={0.48} color={p.deep} /><Person x={86} y={193} scale={0.48} color={p.deep} /><Path d="M18 206 C59 194 93 210 128 199 C146 193 159 194 174 190" stroke={p.warm} strokeWidth={3} fill="none" /></G>;
    case 'champs':
      return <G><Path d="M18 164 L52 134 L80 157 L111 121 L174 169 L174 224 L18 224 Z" fill={p.cool} opacity={0.7} /><Pine x={33} y={128} scale={0.62} color={p.deep} /><Pine x={153} y={121} scale={0.67} color={p.deep} /><Tent x={39} y={163} scale={0.84} fill={p.warm} stroke={p.deep} /><Tent x={119} y={169} scale={0.63} fill={p.cool} stroke={p.deep} /><Campfire x={88} y={184} scale={0.58} warm={p.warm} glow={p.glow} deep={p.deep} /><Person x={76} y={199} scale={0.48} color={p.deep} /><Person x={105} y={199} scale={0.48} color={p.deep} /><Person x={91} y={207} scale={0.45} color={p.deep} /></G>;
    case 'night':
      return <G><Circle cx={137} cy={130} r={18} fill={p.glow} opacity={0.9} /><G fill={p.glow} opacity={0.75}><Circle cx={42} cy={125} r={1.5} /><Circle cx={63} cy={111} r={1.2} /><Circle cx={91} cy={128} r={1.5} /><Circle cx={117} cy={105} r={1.2} /></G><Path d="M30 218 C35 163 55 137 81 140 C109 143 112 167 94 181 C78 191 78 208 91 219" stroke={p.cool} strokeWidth={9} fill="none" strokeLinecap="round" /><Path d="M103 216 C112 172 133 148 166 139" stroke={p.warm} strokeWidth={8} fill="none" strokeLinecap="round" /><Waves y={214} color={p.glow} accent={p.cool} /><Tube x={124} y={216} scale={0.45} color={p.paper} accent={p.warm} /><Tube x={150} y={216} scale={0.41} color={p.paper} accent={p.cool} /></G>;
    case 'trail':
      return <G><Circle cx={137} cy={132} r={21} fill={p.glow} /><Path d="M18 175 L52 138 L77 159 L111 119 L174 172 L174 224 L18 224 Z" fill={p.cool} opacity={0.58} /><Pine x={38} y={135} scale={0.58} color={p.deep} /><Pine x={153} y={132} scale={0.6} color={p.deep} /><Path d="M81 222 C82 195 104 188 99 166 C96 151 108 142 122 139" stroke={p.warm} strokeWidth={7} fill="none" strokeLinecap="round" /><Person x={83} y={187} scale={0.55} color={p.deep} /><Person x={105} y={170} scale={0.47} color={p.deep} /><Waves y={211} color={p.ink} accent={p.cool} /></G>;
    case 'paddle':
      return <G><Path d="M18 159 C42 128 68 135 91 119 C116 102 142 113 174 94 L174 222 L18 222 Z" fill={p.cool} opacity={0.62} /><Palm x={38} y={119} scale={0.56} color={p.deep} /><Palm x={151} y={116} scale={0.52} color={p.deep} /><Waves y={173} color={p.ink} accent={p.glow} /><Path d="M49 193 C69 181 97 180 120 192 C101 202 70 204 49 193 Z" fill={p.warm} stroke={p.deep} strokeWidth={2.5} /><Person x={84} y={176} scale={0.55} color={p.deep} /><Path d="M74 166 L104 202" stroke={p.deep} strokeWidth={3} /><Path d="M70 162 L78 170 M100 198 L108 206" stroke={p.deep} strokeWidth={5} strokeLinecap="round" /></G>;
    case 'everglades':
      return <G><Circle cx={128} cy={137} r={25} fill={p.glow} /><Path d="M18 166 C45 143 73 153 96 140 C120 127 145 136 174 119 L174 224 L18 224 Z" fill={p.cool} opacity={0.5} /><Waves y={185} color={p.ink} accent={p.cool} /><G stroke={p.deep} strokeWidth={2}><Path d="M30 222 L34 175 M43 222 L45 182 M57 222 L56 172 M132 222 L136 177 M148 222 L151 169 M162 222 L163 182" /><Path d="M34 188 L27 179 M34 196 L42 185 M56 187 L48 177 M136 192 L127 181 M151 184 L159 174" /></G><Path d="M92 203 C102 193 119 193 128 201 C115 202 108 207 101 213 C98 209 95 206 92 203 Z" fill={p.deep} /><Circle cx={121} cy={199} r={1.4} fill={p.glow} /></G>;
  }
}

function DateBlock({ stamp, x, y }: { stamp: StampDefinition; x: number; y: number }) {
  const p = stamp.palette;
  return <G><Rect x={x} y={y} width={42} height={56} rx={5} fill={p.deep} stroke={p.paper} strokeWidth={1.5} opacity={0.96} />{stamp.date.map((line, i) => <SvgText key={line} x={x + 21} y={y + 15 + i * 16} textAnchor="middle" fill={p.paper} fontSize={i === 1 ? 10 : 8} fontWeight="800">{line}</SvgText>)}</G>;
}

function PostageFrame({ stamp }: { stamp: StampDefinition }) {
  const p = stamp.palette;
  const teeth = Array.from({ length: 12 }, (_, i) => 17 + i * 14);
  return <G><Rect x={8} y={8} width={174} height={224} rx={4} fill={p.paper} /><G fill="#111812">{teeth.map((x) => <Circle key={`t${x}`} cx={x} cy={8} r={4} />)}{teeth.map((x) => <Circle key={`b${x}`} cx={x} cy={232} r={4} />)}{Array.from({ length: 14 }, (_, i) => 16 + i * 15).map((y) => <Circle key={`l${y}`} cx={8} cy={y} r={4} />)}{Array.from({ length: 14 }, (_, i) => 16 + i * 15).map((y) => <Circle key={`r${y}`} cx={182} cy={y} r={4} />)}</G><Rect x={15} y={15} width={160} height={210} rx={3} fill={p.paper} stroke={p.ink} strokeWidth={3} /><Rect x={20} y={20} width={150} height={200} rx={2} fill={`url(#scene-${stamp.motif})`} stroke={p.deep} strokeWidth={1.5} /></G>;
}

function ArchedFrame({ stamp }: { stamp: StampDefinition }) {
  const p = stamp.palette;
  return <G><Path d="M9 300 L9 73 C9 32 42 9 95 9 C148 9 181 32 181 73 L181 300 Z" fill={p.paper} stroke={p.deep} strokeWidth={3} /><Path d="M17 292 L17 76 C17 40 46 18 95 18 C144 18 173 40 173 76 L173 292 Z" fill={`url(#scene-${stamp.motif})`} stroke={p.ink} strokeWidth={3} /><Path d="M23 286 L23 80 C23 48 49 26 95 26 C141 26 167 48 167 80 L167 286 Z" fill="none" stroke={p.paper} strokeWidth={1.5} opacity={0.85} /></G>;
}

export function StampArt({ code, width = 150 }: { code: PassportStampCode; width?: number }) {
  const stamp = STAMPS[code];
  const tall = stamp.family === 'arched-2026';
  const height = tall ? width * 1.62 : width * 1.25;
  const viewHeight = tall ? 310 : 240;
  const p = stamp.palette;
  const titleStart = tall ? 71 : 44;
  const titleGap = tall ? 19 : 17;
  const sceneShift = tall ? 16 : 0;
  const sceneScale = tall ? 0.95 : 0.92;
  return <Svg width={width} height={height} viewBox={`0 0 190 ${viewHeight}`} preserveAspectRatio="xMidYMid meet">
    <Defs><LinearGradient id={`scene-${stamp.motif}`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={p.cool} /><Stop offset="0.48" stopColor={p.paper} /><Stop offset="1" stopColor={p.warm} /></LinearGradient></Defs>
    {tall ? <ArchedFrame stamp={stamp} /> : <PostageFrame stamp={stamp} />}
    <G transform={`translate(0 ${sceneShift}) scale(1 ${sceneScale})`}><Scene stamp={stamp} /></G>
    <SvgText x={95} y={tall ? 48 : 31} textAnchor="middle" fill={p.deep} fontSize={tall ? 7.5 : 7} fontWeight="900" letterSpacing={0.7}>{stamp.kicker}</SvgText>
    {stamp.title.map((line, i) => <SvgText key={line} x={95} y={titleStart + i * titleGap} textAnchor="middle" fill={p.deep} fontSize={line.length > 18 ? 10.5 : 13} fontWeight="900" letterSpacing={0.2}>{line}</SvgText>)}
    <Circle cx={32} cy={tall ? 267 : 205} r={13} fill={p.deep} stroke={p.paper} strokeWidth={1.5} /><SvgText x={32} y={tall ? 271 : 209} textAnchor="middle" fill={p.paper} fontSize={8} fontWeight="900">MA</SvgText>
    <DateBlock stamp={stamp} x={132} y={tall ? 228 : 164} />
    {stamp.location.map((line, i) => <SvgText key={line} x={95} y={(tall ? 284 : 217) + i * 9} textAnchor="middle" fill={p.deep} fontSize={line.length > 24 ? 5.8 : 6.7} fontWeight="800" letterSpacing={0.25}>{line}</SvgText>)}
    <PaperTexture color={p.deep} height={viewHeight} />
  </Svg>;
}
