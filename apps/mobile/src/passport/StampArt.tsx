import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

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

type Motif =
  | 'launch'
  | 'camp'
  | 'float'
  | 'sunset'
  | 'dragon'
  | 'waterpark'
  | 'beach'
  | 'juneteenth'
  | 'youth'
  | 'night';

type StampDefinition = {
  year: 2025 | 2026;
  kicker?: string;
  title: string[];
  dateTop: string;
  dateBottom: string;
  location: string[];
  ink: string;
  deep: string;
  accent: string;
  accent2: string;
  paper: string;
  sky: string;
  motif: Motif;
};

const stamps: Record<LegacyStampCode, StampDefinition> = {
  'legacy-event-2025-group-launch': {
    year: 2025,
    kicker: 'MA OFFICIAL',
    title: ['GROUP', 'LAUNCH'],
    dateTop: 'MAR',
    dateBottom: '04',
    location: ['JACKSONVILLE, FL'],
    ink: '#124E50',
    deep: '#082F31',
    accent: '#D89A38',
    accent2: '#6E9A83',
    paper: '#E6D5AA',
    sky: '#7AA5A0',
    motif: 'launch',
  },
  'legacy-event-2025-huguenot-camping': {
    year: 2025,
    kicker: 'HUGUENOT PARK',
    title: ['CAMPING TRIP'],
    dateTop: 'MAR',
    dateBottom: '28–30',
    location: ['HUGUENOT MEMORIAL PARK', 'JACKSONVILLE, FL'],
    ink: '#244A2D',
    deep: '#142C1B',
    accent: '#D5792C',
    accent2: '#80915A',
    paper: '#E4D4AB',
    sky: '#8EA38B',
    motif: 'camp',
  },
  'legacy-event-2025-float-out': {
    year: 2025,
    kicker: 'GREAT MELANATED',
    title: ['FLOAT-OUT'],
    dateTop: 'APR',
    dateBottom: '26',
    location: ['NORTH FLORIDA'],
    ink: '#0C6170',
    deep: '#073A43',
    accent: '#E27B35',
    accent2: '#6F9F78',
    paper: '#E6D8B4',
    sky: '#8BB3AE',
    motif: 'float',
  },
  'legacy-event-2025-black-breezy': {
    year: 2025,
    kicker: 'BLACK & BREEZY',
    title: ['THE SUMMER', 'COOL-DOWN'],
    dateTop: 'JUN',
    dateBottom: '20–22',
    location: ['TOMOKA STATE PARK, FL'],
    ink: '#43335E',
    deep: '#241D39',
    accent: '#D87444',
    accent2: '#76538B',
    paper: '#DED0B2',
    sky: '#A26E7A',
    motif: 'sunset',
  },
  'legacy-event-2025-fire-dragon': {
    year: 2025,
    kicker: 'GREAT MELANATED',
    title: ['FIRE DRAGON', 'CONQUEST'],
    dateTop: 'JUL',
    dateBottom: '12',
    location: ['JACKSONVILLE, FL'],
    ink: '#6A261A',
    deep: '#2C120E',
    accent: '#F06B25',
    accent2: '#B43D22',
    paper: '#D9C49B',
    sky: '#7D3529',
    motif: 'dragon',
  },
  'legacy-event-2025-wet-wild': {
    year: 2025,
    kicker: 'GREAT MELANATED',
    title: ['WET & WILD', 'ADVENTURE'],
    dateTop: 'JUL',
    dateBottom: '18',
    location: ['ORLANDO / KISSIMMEE, FL'],
    ink: '#0D6675',
    deep: '#073A43',
    accent: '#E9AF46',
    accent2: '#72A79E',
    paper: '#E2D7B7',
    sky: '#89B3B4',
    motif: 'waterpark',
  },
  'legacy-event-2026-beach-escape': {
    year: 2026,
    kicker: 'THE GREAT',
    title: ['MELANATED', 'BEACH ESCAPE'],
    dateTop: 'MAR',
    dateBottom: '27–29',
    location: ['HUGUENOT MEMORIAL PARK', 'JACKSONVILLE, FL'],
    ink: '#0C5E67',
    deep: '#07333A',
    accent: '#E3A640',
    accent2: '#76A38D',
    paper: '#E7D8B3',
    sky: '#70A6A6',
    motif: 'beach',
  },
  'legacy-event-2026-float-out-juneteenth': {
    year: 2026,
    kicker: 'THE GREAT MELANATED',
    title: ['FLOAT OUT'],
    dateTop: 'JUN',
    dateBottom: '20',
    location: ['WILLIAM F. SHEFFIELD', 'REGIONAL PARK', 'JACKSONVILLE, FL'],
    ink: '#35522C',
    deep: '#182A16',
    accent: '#C64C30',
    accent2: '#D0A83D',
    paper: '#E1D4AE',
    sky: '#77915F',
    motif: 'juneteenth',
  },
  'legacy-event-2026-champs': {
    year: 2026,
    kicker: 'MELANATED ADVENTURES',
    title: ['C.H.A.M.P.s', 'SUMMER SESSION'],
    dateTop: 'JUL',
    dateBottom: '23',
    location: ['JACKSONVILLE AREA'],
    ink: '#773816',
    deep: '#371B0D',
    accent: '#E46723',
    accent2: '#536A35',
    paper: '#DDCDA9',
    sky: '#A65A32',
    motif: 'youth',
  },
  'legacy-event-2026-splash-after-dark': {
    year: 2026,
    kicker: 'MELANATED ADVENTURERS',
    title: ['SPLASH', 'AFTER DARK'],
    dateTop: 'JUL',
    dateBottom: '25',
    location: ['ISLAND H2O', 'ORLANDO AREA'],
    ink: '#43315F',
    deep: '#17132F',
    accent: '#8870BF',
    accent2: '#4E82A8',
    paper: '#D9CEB7',
    sky: '#3B315F',
    motif: 'night',
  },
};

export function isLegacyStampCode(code: string | null | undefined): code is LegacyStampCode {
  return !!code && code in stamps;
}

function Distress({ ink, year }: { ink: string; year: 2025 | 2026 }) {
  const h = year === 2025 ? 240 : 310;
  const flecks = [
    [27, 42, 7, 1], [53, 71, 3, 2], [142, 55, 8, 1], [109, 91, 4, 1],
    [31, 128, 5, 1], [157, 137, 4, 2], [71, 159, 7, 1], [127, 181, 5, 1],
    [46, 208, 9, 1], [151, 217, 5, 1], [94, 231, 4, 1], [119, 267, 8, 1],
  ];
  return (
    <G opacity={0.22}>
      {flecks.filter(([, y]) => y < h - 8).map(([x, y, w, hh], index) => (
        <Rect key={index} x={x} y={y} width={w} height={hh} rx={0.5} fill={ink} />
      ))}
      <Path d={`M18 ${h - 24} C42 ${h - 30}, 59 ${h - 20}, 84 ${h - 26} S132 ${h - 30}, 172 ${h - 23}`} stroke={ink} strokeWidth="1" fill="none" />
    </G>
  );
}

function Palm({ x, y, s, ink }: { x: number; y: number; s: number; ink: string }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Path d="M0 42 C3 22 6 11 11 0" stroke={ink} strokeWidth="4" fill="none" />
      <Path d="M10 2 C-4 -6 -15 -2 -23 5 M10 2 C0 10 -10 16 -20 17 M10 2 C20 -8 33 -8 42 -3 M10 2 C22 5 32 11 40 18" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
    </G>
  );
}

function Person({ x, y, scale = 1, ink }: { x: number; y: number; scale?: number; ink: string }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`} fill={ink}>
      <Circle cx="0" cy="0" r="5" />
      <Path d="M-6 8 Q0 3 6 8 L7 27 L-7 27 Z" />
    </G>
  );
}

function TubePerson({ x, y, s, ink, accent }: { x: number; y: number; s: number; ink: string; accent: string }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Circle cx="0" cy="0" r="14" fill="none" stroke={ink} strokeWidth="4" />
      <Circle cx="0" cy="-9" r="4" fill={ink} />
      <Path d="M-8 -2 Q0 -8 8 -2" stroke={accent} strokeWidth="3" fill="none" />
    </G>
  );
}

function Scene({ stamp }: { stamp: StampDefinition }) {
  const { motif, ink, deep, accent, accent2, sky } = stamp;

  if (motif === 'launch') {
    return (
      <G>
        <Rect x="26" y="91" width="138" height="94" fill={sky} opacity={0.28} />
        <Circle cx="57" cy="110" r="17" fill={accent} opacity={0.88} />
        <G fill={deep} opacity={0.94}>
          <Rect x="30" y="127" width="18" height="42" /><Rect x="51" y="117" width="15" height="52" />
          <Rect x="69" y="132" width="21" height="37" /><Rect x="94" y="106" width="19" height="63" />
          <Rect x="118" y="121" width="16" height="48" /><Rect x="138" y="112" width="19" height="57" />
        </G>
        <Path d="M23 172 C55 163 89 169 118 164 C137 161 151 163 169 158" stroke={ink} strokeWidth="3" fill="none" />
        <Person x={58} y={174} scale={0.78} ink={deep} /><Person x={82} y={173} scale={0.82} ink={deep} />
        <Person x={107} y={174} scale={0.78} ink={deep} /><Person x={132} y={173} scale={0.82} ink={deep} />
        <Circle cx="57" cy="113" r="24" fill="none" stroke={accent2} strokeWidth="1" opacity={0.55} />
      </G>
    );
  }

  if (motif === 'camp') {
    return (
      <G>
        <Rect x="25" y="89" width="140" height="98" fill={sky} opacity={0.25} />
        <Path d="M22 145 C50 119 67 125 91 115 C119 102 140 112 168 97 L168 184 L22 184 Z" fill={accent2} opacity={0.35} />
        <Path d="M21 163 C58 150 83 154 108 146 C132 138 147 143 169 134" stroke={ink} strokeWidth="2" fill="none" />
        <Palm x={42} y={105} s={0.66} ink={deep} /><Palm x={142} y={102} s={0.72} ink={deep} />
        <Path d="M54 177 L83 138 L111 177 Z" fill={accent} stroke={deep} strokeWidth="3" />
        <Line x1="83" y1="139" x2="83" y2="177" stroke={deep} strokeWidth="2" />
        <Path d="M120 177 C111 166 124 160 121 151 C134 160 138 169 131 177 Z" fill={accent} stroke={deep} strokeWidth="2" />
        <Person x={132} y={175} scale={0.55} ink={deep} /><Person x={146} y={176} scale={0.5} ink={deep} />
      </G>
    );
  }

  if (motif === 'float' || motif === 'juneteenth') {
    return (
      <G>
        <Rect x="25" y="92" width="140" height="96" fill={sky} opacity={0.24} />
        <Circle cx="91" cy="111" r="18" fill={accent2} opacity={0.85} />
        <Path d="M20 127 C44 115 61 132 83 123 S121 113 143 122 S159 129 171 124" stroke={ink} strokeWidth="2" fill="none" />
        <Path d="M20 139 C44 127 61 144 83 135 S121 125 143 134 S159 141 171 136" stroke={ink} strokeWidth="2" fill="none" />
        <TubePerson x={53} y={164} s={0.92} ink={deep} accent={accent} />
        <TubePerson x={91} y={170} s={0.88} ink={deep} accent={accent2} />
        <TubePerson x={130} y={163} s={0.96} ink={deep} accent={accent} />
        <Path d="M28 188 C68 180 119 190 166 179" stroke={accent2} strokeWidth="3" fill="none" opacity={0.65} />
        {motif === 'juneteenth' ? (
          <G>
            <Line x1="143" y1="117" x2="143" y2="161" stroke={deep} strokeWidth="3" />
            <Path d="M144 118 L169 124 L144 133 Z" fill="#B53B2C" />
            <Path d="M144 133 L169 139 L144 147 Z" fill="#151515" />
            <Path d="M144 147 L169 153 L144 161 Z" fill="#2F6B36" />
          </G>
        ) : null}
      </G>
    );
  }

  if (motif === 'sunset') {
    return (
      <G>
        <Rect x="25" y="90" width="140" height="100" fill={sky} opacity={0.31} />
        <Circle cx="101" cy="118" r="24" fill={accent} opacity={0.92} />
        <Path d="M24 149 C53 137 76 145 102 139 C128 133 147 140 167 132" stroke={deep} strokeWidth="3" fill="none" />
        <Palm x={42} y={111} s={0.75} ink={deep} /><Palm x={145} y={115} s={0.65} ink={deep} />
        <Path d="M45 169 Q93 191 143 164" stroke={accent2} strokeWidth="4" fill="none" />
        <Line x1="45" y1="168" x2="38" y2="144" stroke={deep} strokeWidth="2" />
        <Line x1="143" y1="164" x2="151" y2="141" stroke={deep} strokeWidth="2" />
        <Person x={94} y={171} scale={0.48} ink={deep} />
      </G>
    );
  }

  if (motif === 'dragon') {
    return (
      <G>
        <Rect x="24" y="90" width="142" height="101" fill={sky} opacity={0.22} />
        <Path d="M25 180 C38 145 57 129 82 126 C99 100 128 94 154 111 C138 111 131 119 130 131 C149 130 160 139 169 154 C147 148 131 152 117 169 C89 191 56 194 25 180 Z" fill={deep} />
        <Path d="M79 137 C63 126 52 115 45 99 C60 108 73 110 88 105" stroke={accent2} strokeWidth="4" fill="none" />
        <Circle cx="131" cy="121" r="2.7" fill={accent} />
        <Path d="M102 183 C88 167 96 153 91 141 C111 151 118 168 108 184 C122 173 128 160 125 148 C145 164 137 185 116 194 Z" fill={accent} />
        <Person x={67} y={177} scale={0.72} ink={paperForContrast(stamp.paper)} />
        <Path d="M62 158 L80 137" stroke={stamp.paper} strokeWidth="3" />
      </G>
    );
  }

  if (motif === 'waterpark') {
    return (
      <G>
        <Rect x="24" y="90" width="142" height="100" fill={sky} opacity={0.26} />
        <Circle cx="139" cy="112" r="17" fill={accent} opacity={0.92} />
        <Path d="M37 173 C47 131 61 113 80 114 C103 115 110 137 91 148 C77 156 75 169 88 179" stroke={deep} strokeWidth="8" fill="none" strokeLinecap="round" />
        <Path d="M106 177 C112 143 128 127 156 116" stroke={accent} strokeWidth="7" fill="none" strokeLinecap="round" />
        <Line x1="35" y1="120" x2="35" y2="176" stroke={ink} strokeWidth="3" />
        <Line x1="156" y1="109" x2="156" y2="177" stroke={ink} strokeWidth="3" />
        <Path d="M20 181 C42 171 57 189 79 180 S118 170 140 179 S157 187 171 181" stroke={ink} strokeWidth="2" fill="none" />
        <TubePerson x={118} y={182} s={0.5} ink={deep} accent={accent} />
        <TubePerson x={145} y={183} s={0.44} ink={deep} accent={accent} />
      </G>
    );
  }

  if (motif === 'beach') {
    return (
      <G>
        <Rect x="25" y="111" width="140" height="110" fill={sky} opacity={0.29} />
        <Circle cx="99" cy="136" r="22" fill={accent} opacity={0.92} />
        <Path d="M23 161 C49 151 65 167 89 159 S128 151 151 158 S162 164 171 160" stroke={ink} strokeWidth="2" fill="none" />
        <Path d="M23 174 C49 164 65 180 89 172 S128 164 151 171 S162 177 171 173" stroke={ink} strokeWidth="2" fill="none" />
        <Palm x={43} y={130} s={0.63} ink={deep} /><Palm x={150} y={133} s={0.56} ink={deep} />
        <Path d="M107 177 L145 177 L145 169 L165 169" stroke={deep} strokeWidth="3" fill="none" />
        <Path d="M45 204 L58 177 L72 204 M77 204 L91 177 L104 204" stroke={deep} strokeWidth="3" fill="none" />
        <Person x={61} y={188} scale={0.48} ink={deep} /><Person x={88} y={188} scale={0.48} ink={deep} />
      </G>
    );
  }

  if (motif === 'youth') {
    return (
      <G>
        <Rect x="25" y="110" width="140" height="112" fill={sky} opacity={0.23} />
        <Path d="M21 167 L55 136 L78 157 L111 124 L168 172 L168 221 L21 221 Z" fill={accent2} opacity={0.42} />
        <Path d="M44 202 L72 163 L101 202 Z" fill={accent} stroke={deep} strokeWidth="3" />
        <Path d="M109 202 L134 172 L157 202 Z" fill={accent2} stroke={deep} strokeWidth="3" />
        <Path d="M96 217 C83 202 100 191 96 178 C114 190 118 205 107 218 C121 209 126 199 124 188 C141 204 132 220 116 225 Z" fill={accent} />
        <Person x={65} y={212} scale={0.55} ink={deep} /><Person x={88} y={215} scale={0.6} ink={deep} />
        <Person x={132} y={213} scale={0.55} ink={deep} />
        <Circle cx="146" cy="148" r="6" fill={accent} opacity={0.8} />
      </G>
    );
  }

  return (
    <G>
      <Rect x="25" y="110" width="140" height="112" fill={sky} opacity={0.42} />
      <Circle cx="139" cy="137" r="21" fill="#E3D7B6" opacity={0.88} />
      <Circle cx="147" cy="131" r="21" fill={deep} opacity={0.42} />
      <Palm x={39} y={143} s={0.62} ink={deep} /><Palm x={154} y={150} s={0.52} ink={deep} />
      <Path d="M39 209 C49 164 61 144 82 146 C107 148 111 174 91 183 C76 190 78 205 91 213" stroke={accent2} strokeWidth="8" fill="none" strokeLinecap="round" />
      <Path d="M108 211 C115 176 130 156 158 149" stroke={accent} strokeWidth="7" fill="none" strokeLinecap="round" />
      <Path d="M20 219 C42 209 57 227 79 218 S118 208 140 217 S157 225 171 219" stroke="#A7B8CC" strokeWidth="2" fill="none" opacity={0.8} />
      <Person x={62} y={218} scale={0.5} ink="#161326" /><Person x={93} y={217} scale={0.5} ink="#161326" />
      <Person x={127} y={218} scale={0.5} ink="#161326" />
      <Circle cx="42" cy="126" r="1.4" fill="#F3E6C9" /><Circle cx="67" cy="117" r="1.1" fill="#F3E6C9" />
      <Circle cx="97" cy="128" r="1.3" fill="#F3E6C9" /><Circle cx="117" cy="116" r="1.1" fill="#F3E6C9" />
    </G>
  );
}

function paperForContrast(paper: string) {
  return paper;
}

function DateBlock({ stamp }: { stamp: StampDefinition }) {
  const y = stamp.year === 2025 ? 166 : 232;
  return (
    <G>
      <Rect x="132" y={y} width="37" height="48" rx="2" fill={stamp.deep} stroke={stamp.paper} strokeWidth="1.2" />
      <SvgText x="150.5" y={y + 14} fill={stamp.paper} fontSize="8" fontWeight="900" textAnchor="middle" letterSpacing="1">{stamp.dateTop}</SvgText>
      <SvgText x="150.5" y={y + 30} fill={stamp.paper} fontSize={stamp.dateBottom.length > 3 ? 8.7 : 13} fontWeight="900" textAnchor="middle">{stamp.dateBottom}</SvgText>
      <SvgText x="150.5" y={y + 42} fill={stamp.paper} fontSize="7.4" fontWeight="800" textAnchor="middle">{stamp.year}</SvgText>
    </G>
  );
}

function Frame2025({ stamp }: { stamp: StampDefinition }) {
  return (
    <G>
      <Rect x="5" y="5" width="180" height="230" rx="3" fill={stamp.paper} stroke={stamp.paper} strokeWidth="8" strokeDasharray="6 4" />
      <Rect x="12" y="12" width="166" height="216" rx="2" fill={stamp.deep} stroke={stamp.ink} strokeWidth="3.5" />
      <Rect x="18" y="18" width="154" height="204" rx="2" fill="none" stroke={stamp.paper} strokeWidth="1.4" opacity={0.78} />
      <Path d="M24 27 H166 M24 216 H166" stroke={stamp.accent} strokeWidth="1" opacity={0.55} />
    </G>
  );
}

function Frame2026({ stamp }: { stamp: StampDefinition }) {
  return (
    <G>
      <Path d="M95 5 C145 5 181 36 181 79 L181 301 L9 301 L9 79 C9 36 45 5 95 5 Z" fill={stamp.paper} stroke={stamp.paper} strokeWidth="8" />
      <Path d="M95 13 C140 13 173 40 173 80 L173 293 L17 293 L17 80 C17 40 50 13 95 13 Z" fill={stamp.deep} stroke={stamp.ink} strokeWidth="4" />
      <Path d="M95 20 C136 20 165 44 165 82 L165 285 L25 285 L25 82 C25 44 54 20 95 20 Z" fill="none" stroke={stamp.paper} strokeWidth="1.5" opacity={0.76} />
      <Path d="M39 34 Q95 14 151 34" stroke={stamp.accent} strokeWidth="1.2" fill="none" opacity={0.55} />
    </G>
  );
}

export function StampArt({ code, width = 150 }: { code: LegacyStampCode; width?: number }) {
  const stamp = stamps[code];
  const is2025 = stamp.year === 2025;
  const viewHeight = is2025 ? 240 : 310;
  const height = width * (viewHeight / 190);
  const titleY = is2025 ? 47 : 62;
  const titleStep = is2025 ? 17 : 18;

  return (
    <Svg width={width} height={height} viewBox={`0 0 190 ${viewHeight}`}>
      <Defs>
        <LinearGradient id={`sky-${code}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stamp.sky} stopOpacity="0.92" />
          <Stop offset="1" stopColor={stamp.deep} stopOpacity="0.14" />
        </LinearGradient>
      </Defs>

      {is2025 ? <Frame2025 stamp={stamp} /> : <Frame2026 stamp={stamp} />}

      <SvgText x="95" y={is2025 ? 28 : 34} fill={stamp.paper} fontSize="7.4" fontWeight="800" textAnchor="middle" letterSpacing="1.1">MELANATED ADVENTURERS</SvgText>
      <Circle cx="31" cy={is2025 ? 29 : 39} r="10" fill="none" stroke={stamp.accent} strokeWidth="1.6" />
      <SvgText x="31" y={is2025 ? 32 : 42} fill={stamp.paper} fontSize="7.4" fontWeight="900" textAnchor="middle">MA</SvgText>

      {stamp.kicker ? (
        <SvgText x="95" y={is2025 ? 43 : 53} fill={stamp.accent} fontSize="7.6" fontWeight="900" textAnchor="middle" letterSpacing="0.7">{stamp.kicker}</SvgText>
      ) : null}

      {stamp.title.map((line, index) => (
        <SvgText
          key={`${code}-${line}`}
          x="95"
          y={titleY + index * titleStep}
          fill={stamp.paper}
          fontSize={line.length > 13 ? 12.2 : line.length > 9 ? 14 : 16}
          fontWeight="900"
          textAnchor="middle"
          letterSpacing="0.35"
        >
          {line}
        </SvgText>
      ))}

      <G transform={`translate(0 ${is2025 ? 4 : 7})`}>
        <Scene stamp={stamp} />
      </G>

      {stamp.motif === 'juneteenth' ? (
        <G>
          <Rect x="38" y="94" width="114" height="19" rx="2" fill={stamp.paper} stroke={stamp.deep} strokeWidth="1.4" />
          <SvgText x="95" y="107" fill={stamp.deep} fontSize="8.2" fontWeight="900" textAnchor="middle" letterSpacing="0.5">JUNETEENTH EDITION</SvgText>
        </G>
      ) : null}

      <DateBlock stamp={stamp} />

      <G>
        {stamp.location.map((line, index) => {
          const baseY = is2025 ? 214 : 277 - (stamp.location.length - 1) * 8;
          return (
            <SvgText key={`${code}-loc-${line}`} x="95" y={baseY + index * 9} fill={stamp.paper} fontSize="7.2" fontWeight="800" textAnchor="middle" letterSpacing="0.45">{line}</SvgText>
          );
        })}
      </G>

      <Distress ink={stamp.paper} year={stamp.year} />
    </Svg>
  );
}
