/**
 * Marca SASTRA como componentes React (a partir de src/brand/isotipo.svg y lockup.svg).
 * Tinta = currentColor para adaptarse al modo oscuro; el ojo de la aguja usa `fondo`.
 */
import type { SVGProps } from 'react';

const S_TRANSFORM = 'translate(72.778,180.832) scale(0.16785,-0.16785)';
const S_TRANSFORM_SOLA = 'translate(70.383,186.815) scale(0.18492,-0.18492)';
const S_D =
  'M439 658Q348 693 267.5 693.0Q187 693 142.0 659.0Q97 625 97 565Q97 492 173 452Q207 435 247.5 420.5Q288 406 329.0 388.0Q370 370 404.0 347.0Q438 324 459.0 283.5Q480 243 480.0 180.5Q480 118 445.0 74.0Q410 30 360.5 14.5Q311 -1 245 -1Q122 -1 35 60L40 68Q73 42 125.5 25.5Q178 9 233 9Q314 9 371.5 46.5Q429 84 429 157Q429 237 353 282Q319 302 278.5 319.0Q238 336 197.0 354.5Q156 373 122 396Q46 446 46 538Q46 611 95.0 656.5Q144 702 242.5 702.0Q341 702 443 668Z';
const HALO = { x1: 156.5, y1: 47.6, x2: 79.5, y2: 192.4, w: 10 };
const AGUJA =
  'M 156.50 47.60 L 153.14 50.46 L 150.62 53.76 L 148.24 57.14 L 145.93 60.55 L 144.11 64.23 L 142.29 67.91 L 140.47 71.58 L 138.65 75.26 L 136.83 78.93 L 135.00 82.61 L 133.18 86.28 L 131.35 89.95 L 129.53 93.62 L 127.70 97.30 L 125.87 100.97 L 124.04 104.64 L 122.21 108.31 L 120.37 111.98 L 118.54 115.64 L 116.70 119.31 L 114.86 122.98 L 113.02 126.64 L 111.18 130.31 L 109.34 133.97 L 107.50 137.63 L 105.65 141.29 L 103.80 144.95 L 101.95 148.61 L 100.10 152.27 L 98.24 155.93 L 96.39 159.59 L 94.53 163.24 L 92.66 166.89 L 90.80 170.55 L 88.93 174.20 L 87.05 177.84 L 85.18 181.49 L 83.30 185.13 L 81.41 188.77 L 79.50 192.40 L 79.50 192.40 L 81.45 188.79 L 83.41 185.19 L 85.38 181.59 L 87.35 178.00 L 89.33 174.41 L 91.31 170.82 L 93.29 167.23 L 95.28 163.64 L 97.27 160.06 L 99.26 156.47 L 101.26 152.89 L 103.25 149.31 L 105.25 145.73 L 107.25 142.15 L 109.26 138.57 L 111.26 134.99 L 113.27 131.41 L 115.28 127.84 L 117.29 124.26 L 119.30 120.69 L 121.31 117.12 L 123.33 113.54 L 125.34 109.97 L 127.36 106.40 L 129.38 102.83 L 131.40 99.26 L 133.42 95.69 L 135.44 92.13 L 137.47 88.56 L 139.49 84.99 L 141.52 81.43 L 143.55 77.86 L 145.57 74.30 L 147.60 70.73 L 149.63 67.17 L 151.67 63.60 L 153.21 59.78 L 154.68 55.92 L 156.01 51.98 L 156.50 47.60 Z';
const OJO = { cx: 150.72, cy: 58.46, rx: 7.00, ry: 1.30, transform: 'rotate(118.00 150.72 58.46)' };

// Wordmark SASTRA (Bodoni Moda 500 convertido a trazados)
const LETRA_S =
  'M624 -29Q500 -29 409.0 9.5Q318 48 255 116L143 -20H108V408H148Q167 326 203.5 254.0Q240 182 296.5 128.0Q353 74 429.5 43.0Q506 12 607 12Q710 12 785.0 47.5Q860 83 901.0 149.5Q942 216 942 310Q942 396 899.0 455.0Q856 514 784.0 557.0Q712 600 627.0 637.0Q542 674 457.0 715.0Q372 756 300.0 811.5Q228 867 185.0 947.0Q142 1027 142 1142Q142 1257 199.5 1341.5Q257 1426 353.5 1473.0Q450 1520 565 1520Q662 1520 743.0 1489.5Q824 1459 885 1397L996 1520H1029V1098H991Q965 1223 908.5 1307.5Q852 1392 769.0 1434.0Q686 1476 583 1476Q447 1476 376.0 1411.0Q305 1346 305 1238Q305 1161 348.0 1107.5Q391 1054 461.0 1013.0Q531 972 615.5 935.0Q700 898 784.0 855.5Q868 813 938.5 754.0Q1009 695 1051.5 611.5Q1094 528 1094 408Q1094 276 1035.5 177.5Q977 79 871.0 25.0Q765 -29 624 -29Z';
const LETRA_A =
  'M425 468V507H1064V468ZM831 1529 1347 39H1503V0H892V39H1089L703 1234L286 39H498V0H57V39H241L765 1529Z';
const LETRA_T =
  'M349 0V39H569V1461H391Q306 1461 250.0 1431.0Q194 1401 162.0 1346.0Q130 1291 115.5 1214.0Q101 1137 98 1042H57V1500H1305V1042H1266Q1263 1137 1248.0 1214.0Q1233 1291 1200.5 1346.0Q1168 1401 1112.5 1431.0Q1057 1461 971 1461H793V39H1013V0Z';
const LETRA_R =
  'M418 756V779H715Q811 779 877.5 817.5Q944 856 978.5 931.5Q1013 1007 1013 1119Q1013 1231 978.5 1307.0Q944 1383 877.5 1422.0Q811 1461 715 1461H57V1500H729Q884 1500 1000.5 1459.0Q1117 1418 1181.5 1333.5Q1246 1249 1246 1119Q1246 989 1185.5 909.0Q1125 829 1009.5 792.5Q894 756 729 756ZM57 0V39H711V0ZM272 21V1475H496V21ZM1219 -11Q1128 -11 1076.5 20.5Q1025 52 1001.5 105.5Q978 159 972.0 226.0Q966 293 965.0 364.0Q964 435 957.5 502.0Q951 569 927.5 622.5Q904 676 852.0 708.0Q800 740 708 740H418V761H781Q923 761 1006.5 722.0Q1090 683 1132.0 618.0Q1174 553 1188.5 475.5Q1203 398 1204.0 321.0Q1205 244 1208.5 179.0Q1212 114 1230.5 75.0Q1249 36 1300 36Q1332 36 1357.0 42.5Q1382 49 1402 59L1416 22Q1392 9 1339.0 -1.0Q1286 -11 1219 -11Z';

function TrazosIsotipo({ fondo, simple }: { fondo: string; simple: boolean }) {
  // "Botón": disco en currentColor; la S y la aguja en el color del fondo (en modo oscuro se invierte solo).
  return (
    <>
      <circle cx="120" cy="120" r="108" fill="currentColor" />
      <path transform={simple ? S_TRANSFORM_SOLA : S_TRANSFORM} d={S_D} fill={fondo} />
      {simple ? null : (
        <>
          <line x1={HALO.x1} y1={HALO.y1} x2={HALO.x2} y2={HALO.y2} stroke="currentColor" strokeWidth={HALO.w} strokeLinecap="round" />
          <path d={AGUJA} fill={fondo} />
          <ellipse cx={OJO.cx} cy={OJO.cy} rx={OJO.rx} ry={OJO.ry} transform={OJO.transform} fill="currentColor" />
        </>
      )}
    </>
  );
}

function Wordmark() {
  return (
    <g fill="currentColor" transform="translate(-3.050,43.181) scale(0.02824,-0.02824)">
      <path d={LETRA_S} />
      <path transform="translate(1488,0)" d={LETRA_A} />
      <path transform="translate(3368,0)" d={LETRA_S} />
      <path transform="translate(4856,0)" d={LETRA_T} />
      <path transform="translate(6537,0)" d={LETRA_R} />
      <path transform="translate(8319,0)" d={LETRA_A} />
    </g>
  );
}

interface PropsIsotipo extends Omit<SVGProps<SVGSVGElement>, 'fill'> {
  /** Lado en px */
  tamano?: number;
  /** Color del ojo de la aguja (el fondo sobre el que se apoya) */
  fondo?: string;
  /** Disco y S sin aguja para tamaños ≤ 48 px */
  simple?: boolean;
  titulo?: string;
}

export function Isotipo({ tamano = 40, fondo = 'var(--fondo)', simple, titulo, ...resto }: PropsIsotipo) {
  const esSimple = simple ?? tamano <= 48;
  return (
    <svg
      viewBox="0 0 240 240"
      width={tamano}
      height={tamano}
      role={titulo ? 'img' : undefined}
      aria-hidden={titulo ? undefined : true}
      {...resto}
    >
      {titulo ? <title>{titulo}</title> : null}
      <TrazosIsotipo fondo={fondo} simple={esSimple} />
    </svg>
  );
}

interface PropsLockup extends Omit<SVGProps<SVGSVGElement>, 'fill'> {
  /** Alto en px; el ancho se deriva (relación 420.34 : 120) */
  altura?: number;
  fondo?: string;
  titulo?: string;
}

export function Lockup({ altura = 32, fondo = 'var(--fondo)', titulo = 'SASTRA', ...resto }: PropsLockup) {
  const ancho = (altura * 420.34) / 120;
  return (
    <svg viewBox="0 0 420.34 120" width={ancho} height={altura} role="img" {...resto}>
      <title>{titulo}</title>
      <g transform="scale(0.5)">
        <TrazosIsotipo fondo={fondo} simple={false} />
      </g>
      <g transform="translate(146,38)">
        <Wordmark />
      </g>
    </svg>
  );
}

export function Marca(props: { variante?: 'isotipo' | 'lockup'; altura?: number; fondo?: string }) {
  const { variante = 'lockup', altura = 32, fondo } = props;
  return variante === 'isotipo' ? (
    <Isotipo tamano={altura} fondo={fondo} titulo="SASTRA" />
  ) : (
    <Lockup altura={altura} fondo={fondo} />
  );
}
