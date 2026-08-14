import { Image, type ImageSourcePropType } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

export type LegacyStampCode =
  | 'legacy-event-2025-group-launch'
  | 'legacy-event-2025-huguenot-camping'
  | 'legacy-event-2025-float-out'
  | 'legacy-event-2025-black-breezy'
  | 'legacy-event-2025-fire-dragon'
  | 'legacy-event-2025-wet-wild'
  | 'legacy-event-2026-beach-escape'
  | 'legacy-event-2026-float-out-juneteenth'
  | 'legacy-event-2026-champs'
  | 'legacy-event-2026-splash-after-dark';

type StampDefinition = {
  year: 2025 | 2026;
  title: string[];
  date: string;
  location: string;
  ink: string;
  accent: string;
  paper: string;
  motif: 'launch' | 'camp' | 'float' | 'sunset' | 'dragon' | 'waterpark' | 'beach' | 'juneteenth' | 'youth' | 'night';
};

const stamps: Record<LegacyStampCode, StampDefinition> = {
  'legacy-event-2025-group-launch': { year: 2025, title: ['MA OFFICIAL', 'GROUP LAUNCH'], date: 'MAR 04', location: 'JACKSONVILLE, FL', ink: '#0C5E62', accent: '#E6A84A', paper: '#E8D8B4', motif: 'launch' },
  'legacy-event-2025-huguenot-camping': { year: 2025, title: ['HUGUENOT PARK', 'CAMPING TRIP'], date: 'MAR 28–30', location: 'JACKSONVILLE, FL', ink: '#234D2F', accent: '#D67A2B', paper: '#E4D5AF', motif: 'camp' },
  'legacy-event-2025-float-out': { year: 2025, title: ['GREAT MELANATED', 'FLOAT-OUT'], date: 'APR 26', location: 'NORTH FLORIDA', ink: '#0B6371', accent: '#E9873D', paper: '#E5D9B7', motif: 'float' },
  'legacy-event-2025-black-breezy': { year: 2025, title: ['BLACK & BREEZY', 'SUMMER COOL-DOWN'], date: 'JUN 20–22', location: 'TOMOKA STATE PARK', ink: '#3D315C', accent: '#D97845', paper: '#DED0B2', motif: 'sunset' },
  'legacy-event-2025-fire-dragon': { year: 2025, title: ['GREAT MELANATED', 'FIRE DRAGON', 'CONQUEST'], date: 'JUL 12', location: 'JACKSONVILLE, FL', ink: '#5D2418', accent: '#E56A2B', paper: '#D7C49E', motif: 'dragon' },
  'legacy-event-2025-wet-wild': { year: 2025, title: ['GREAT MELANATED', 'WET & WILD', 'ADVENTURE'], date: 'JUL 18', location: 'ORLANDO, FL', ink: '#0D6676', accent: '#F0B554', paper: '#E2D7B7', motif: 'waterpark' },
  'legacy-event-2026-beach-escape': { year: 2026, title: ['THE GREAT', 'MELANATED', 'BEACH ESCAPE'], date: 'MAR 27–29', location: 'JACKSONVILLE, FL', ink: '#0E6172', accent: '#E3AC4A', paper: '#E6DAB8', motif: 'beach' },
  'legacy-event-2026-float-out-juneteenth': { year: 2026, title: ['GREAT MELANATED', 'FLOAT OUT', 'JUNETEENTH EDITION'], date: 'JUN 20', location: 'JACKSONVILLE, FL', ink: '#314F28', accent: '#B4492C', paper: '#E1D4AE', motif: 'juneteenth' },
  'legacy-event-2026-champs': { year: 2026, title: ['MELANATED ADVENTURES', 'C.H.A.M.P.s', 'SUMMER SESSION'], date: 'JUL 23', location: 'JACKSONVILLE AREA', ink: '#7A3E1C', accent: '#3E6331', paper: '#DDCDA9', motif: 'youth' },
  'legacy-event-2026-splash-after-dark': { year: 2026, title: ['SPLASH', 'AFTER DARK'], date: 'JUL 25', location: 'ORLANDO AREA', ink: '#3A285C', accent: '#4E78A8', paper: '#D8CEB7', motif: 'night' },
};

const rasterStampAssets: Partial<Record<LegacyStampCode, ImageSourcePropType>> = {
  'legacy-event-2025-group-launch': require('../../assets/stamps/2025-group-launch.jpg'),
  'legacy-event-2025-huguenot-camping': require('../../assets/stamps/2025-huguenot-camping.jpg'),
  'legacy-event-2025-float-out': require('../../assets/stamps/2025-float-out.jpg'),
  'legacy-event-2026-beach-escape': require('../../assets/stamps/2026-beach-escape.jpg'),
};

export function isLegacyStampCode(code: string | null | undefined): code is LegacyStampCode {
  return !!code && code in stamps;
}

function Scene({ motif, ink, accent }: Pick<StampDefinition, 'motif' | 'ink' | 'accent'>) {
  const commonMountains = <Path d="M20 116 L60 82 L85 104 L115 68 L158 116 Z" fill={ink} opacity={0.26} />;
  const waves = <G stroke={ink} strokeWidth={2.3} fill="none" opacity={0.85}><Path d="M16 118 C38 108 52 128 74 118 S110 108 132 118 S158 128 174 118" /><Path d="M16 128 C38 118 52 138 74 128 S110 118 132 128 S158 138 174 128" /></G>;

  if (motif === 'launch') return <G>{commonMountains}<Circle cx="95" cy="83" r="17" fill={accent} opacity={0.85} /><Path d="M32 131 L32 103 L43 95 L54 103 L54 131 M67 131 L67 91 L79 82 L91 91 L91 131 M107 131 L107 98 L119 90 L131 98 L131 131 M143 131 L143 86 L154 77 L165 86 L165 131" stroke={ink} strokeWidth={5} fill="none" /><G fill={ink}><Circle cx="55" cy="145" r="6"/><Circle cx="75" cy="143" r="6"/><Circle cx="95" cy="145" r="6"/><Circle cx="115" cy="143" r="6"/><Circle cx="135" cy="145" r="6"/></G></G>;
  if (motif === 'camp') return <G>{commonMountains}<Circle cx="142" cy="82" r="15" fill={accent} opacity={0.8}/><Path d="M45 148 L82 101 L119 148 Z" fill={accent} stroke={ink} strokeWidth={4}/><Line x1="82" y1="101" x2="82" y2="148" stroke={ink} strokeWidth={3}/><Path d="M132 151 C120 138 137 132 130 118 C146 128 151 141 143 151 Z" fill={accent} stroke={ink} strokeWidth={3}/></G>;
  if (motif === 'float' || motif === 'juneteenth') return <G><Circle cx="95" cy="78" r="18" fill={accent} opacity={0.85}/>{waves}<G stroke={ink} strokeWidth={5} fill="none"><Circle cx="54" cy="144" r="17"/><Circle cx="96" cy="149" r="17"/><Circle cx="139" cy="143" r="17"/></G>{motif === 'juneteenth' ? <G><Path d="M144 87 L144 126" stroke={ink} strokeWidth={4}/><Path d="M145 88 L177 98 L145 108 Z" fill={accent}/></G> : null}</G>;
  if (motif === 'sunset' || motif === 'beach') return <G><Circle cx="95" cy="86" r="22" fill={accent} opacity={0.85}/>{waves}<Path d="M23 130 C45 111 55 105 68 108 C62 93 67 78 82 65" stroke={ink} strokeWidth={6} fill="none"/><Path d="M68 89 C50 82 43 76 36 65 M70 86 C79 75 88 67 99 61" stroke={ink} strokeWidth={4} fill="none"/><Path d="M126 150 Q143 124 163 150" stroke={ink} strokeWidth={5} fill="none"/></G>;
  if (motif === 'dragon') return <G><Path d="M28 142 C43 112 69 91 100 93 C122 64 157 64 174 86 C155 82 144 89 139 101 C156 103 168 114 174 128 C151 119 134 122 119 139 C91 158 58 160 28 142 Z" fill={ink} opacity={0.9}/><Path d="M96 142 C84 127 92 117 89 104 C106 115 111 129 103 143 C115 132 121 123 120 111 C137 127 128 145 112 153 Z" fill={accent}/></G>;
  if (motif === 'waterpark') return <G>{waves}<Path d="M42 143 C53 110 61 84 86 84 C112 84 114 110 94 117 C76 124 77 139 92 143" stroke={ink} strokeWidth={9} fill="none"/><Path d="M121 146 C129 116 140 93 166 86" stroke={accent} strokeWidth={8} fill="none"/><Circle cx="145" cy="75" r="16" fill={accent} opacity={0.8}/></G>;
  if (motif === 'youth') return <G>{commonMountains}<Circle cx="95" cy="78" r="15" fill={accent} opacity={0.8}/><G fill={ink}><Circle cx="58" cy="124" r="9"/><Circle cx="95" cy="116" r="10"/><Circle cx="132" cy="124" r="9"/></G><Path d="M45 154 Q58 133 71 154 M80 154 Q95 128 110 154 M119 154 Q132 133 145 154" stroke={ink} strokeWidth={8} fill="none"/></G>;
  return <G><Circle cx="142" cy="78" r="19" fill={accent} opacity={0.8}/><Circle cx="149" cy="72" r="19" fill={ink} opacity={0.38}/>{waves}<Path d="M44 145 C54 115 62 90 86 90 C111 90 112 115 95 121 C80 127 80 140 91 145" stroke={accent} strokeWidth={8} fill="none"/><G fill={ink}><Circle cx="123" cy="141" r="7"/><Circle cx="146" cy="145" r="7"/></G></G>;
}

function VectorStampArt({ code, width }: { code: LegacyStampCode; width: number }) {
  const stamp = stamps[code];
  const height = stamp.year === 2025 ? width * 1.18 : width * 1.48;
  const viewHeight = stamp.year === 2025 ? 220 : 272;
  const titleStart = stamp.year === 2025 ? 40 : 46;
  const sceneOffset = stamp.year === 2025 ? 31 : 45;

  return (
    <Svg width={width} height={height} viewBox={`0 0 190 ${viewHeight}`}>
      {stamp.year === 2025 ? (
        <>
          <Rect x="6" y="6" width="178" height="208" rx="6" fill={stamp.paper} stroke="#E8D7AE" strokeWidth="8" strokeDasharray="7 5" />
          <Rect x="13" y="13" width="164" height="194" rx="4" fill={stamp.paper} stroke={stamp.ink} strokeWidth="4" />
          <Rect x="18" y="18" width="154" height="184" rx="3" fill="none" stroke={stamp.ink} strokeWidth="1.5" opacity={0.7} />
        </>
      ) : (
        <>
          <Path d="M95 6 C144 6 177 35 177 74 L177 262 L13 262 L13 74 C13 35 46 6 95 6 Z" fill={stamp.paper} stroke="#E8D7AE" strokeWidth="8" />
          <Path d="M95 13 C139 13 169 39 169 76 L169 254 L21 254 L21 76 C21 39 51 13 95 13 Z" fill={stamp.paper} stroke={stamp.ink} strokeWidth="4" />
          <Path d="M95 20 C135 20 162 43 162 78 L162 246 L28 246 L28 78 C28 43 55 20 95 20 Z" fill="none" stroke={stamp.ink} strokeWidth="1.5" opacity={0.7} />
        </>
      )}

      <SvgText x="95" y={stamp.year === 2025 ? 31 : 34} fill={stamp.ink} fontSize="8.5" fontWeight="800" textAnchor="middle" letterSpacing="1">MELANATED ADVENTURERS</SvgText>
      <Circle cx="33" cy={stamp.year === 2025 ? 31 : 37} r="11" fill="none" stroke={stamp.ink} strokeWidth="2" />
      <SvgText x="33" y={stamp.year === 2025 ? 34 : 40} fill={stamp.ink} fontSize="8" fontWeight="900" textAnchor="middle">MA</SvgText>

      {stamp.title.map((line, index) => (
        <SvgText key={line} x="95" y={titleStart + index * 16} fill={stamp.ink} fontSize={stamp.title.length === 3 ? 12.5 : 14} fontWeight="900" textAnchor="middle" letterSpacing="0.4">{line}</SvgText>
      ))}

      <G transform={`translate(0 ${sceneOffset + stamp.title.length * 8})`}>
        <Scene motif={stamp.motif} ink={stamp.ink} accent={stamp.accent} />
      </G>

      <Rect x="133" y={stamp.year === 2025 ? 154 : 194} width="34" height="38" rx="3" fill={stamp.ink} />
      <SvgText x="150" y={stamp.year === 2025 ? 170 : 210} fill={stamp.paper} fontSize="8.5" fontWeight="900" textAnchor="middle">{stamp.date}</SvgText>
      <SvgText x="150" y={stamp.year === 2025 ? 184 : 224} fill={stamp.paper} fontSize="9" fontWeight="900" textAnchor="middle">{stamp.year}</SvgText>

      <Line x1="24" x2="166" y1={stamp.year === 2025 ? 194 : 236} y2={stamp.year === 2025 ? 194 : 236} stroke={stamp.ink} strokeWidth="1.5" opacity={0.75} />
      <SvgText x="95" y={stamp.year === 2025 ? 207 : 250} fill={stamp.ink} fontSize="8.5" fontWeight="800" textAnchor="middle" letterSpacing="0.6">{stamp.location}</SvgText>
    </Svg>
  );
}

export function StampArt({ code, width = 150 }: { code: LegacyStampCode; width?: number }) {
  const raster = rasterStampAssets[code];
  if (raster) {
    const height = width;
    return <Image source={raster} style={{ width, height }} resizeMode="contain" />;
  }

  return <VectorStampArt code={code} width={width} />;
}
