// One line-icon set (1.8 px stroke on a 24 px grid), the same shapes as the mock-up.
import Svg, { Path, Rect, Circle } from 'react-native-svg';

const SHAPES = {
  phone: [['rect', { x: 6, y: 2.5, width: 12, height: 19, rx: 2.5 }], ['path', 'M11 18.5h2']],
  tablet: [['rect', { x: 3.5, y: 3, width: 17, height: 18, rx: 2.5 }], ['path', 'M11 18h2']],
  lock: [['rect', { x: 4.5, y: 10.5, width: 15, height: 10, rx: 2 }], ['path', 'M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2']],
  shield: [['path', 'M12 3l7.5 3v5.5c0 4.6-3.2 8.1-7.5 9.5-4.3-1.4-7.5-4.9-7.5-9.5V6L12 3z'], ['path', 'M9 12l2.2 2.2L15.5 10']],
  key: [['circle', { cx: 8, cy: 15, r: 4 }], ['path', 'M10.9 12.1L19 4M16 7l2.5 2.5M14 9l2 2']],
  faceid: [['path', 'M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16'], ['path', 'M9 9.5v1M15 9.5v1M12 9.5V13h-1M9.5 15.5c1.5 1.1 3.5 1.1 5 0']],
  finger: [['path', 'M12 11v3.5c0 2-.6 4-1.6 5.6M8.5 20c.8-1.5 1.2-3.3 1.2-5.5v-2a2.3 2.3 0 0 1 4.6 0v1.8M6.2 17.5c.5-1.3.8-2.8.8-4.5v-1a5 5 0 0 1 10 0v2.5c0 1.6-.2 3-.6 4.4M4.6 14.3c.3-.8.4-1.6.4-2.4a7 7 0 0 1 12.6-4.2M19 11.9v1.6']],
  message: [['path', 'M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.1-4.2A8.5 8.5 0 1 1 20.5 12z'], ['path', 'M8.5 12h.01M12 12h.01M15.5 12h.01']],
  check: [['path', 'M5 12.5l4.5 4.5L19 7.5']],
  x: [['path', 'M6 6l12 12M18 6L6 18']],
  alert: [['path', 'M12 4l9 16H3L12 4z'], ['path', 'M12 10v4M12 17h.01']],
  info: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', 'M12 11v5M12 8h.01']],
  alertc: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', 'M12 7.5v5.5M12 16.5h.01']],
  wifioff: [['path', 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4.6-2.5M19 12.6a10 10 0 0 0-2.3-1.6M2 8.8a15 15 0 0 1 4-2.5M22 8.8A15 15 0 0 0 11 5.1M12 20h.01']],
  clock: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', 'M12 7v5l3.2 2']],
  moon: [['path', 'M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z']],
  eye: [['path', 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z'], ['circle', { cx: 12, cy: 12, r: 3 }]],
  eyeoff: [['path', 'M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.3 2 12 2 12s3.6 6 10 6c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2']],
  home: [['path', 'M3.5 10.5L12 4l8.5 6.5M5.5 9.5V20h13V9.5M10 20v-5.5h4V20']],
  box: [['path', 'M20.5 7.5L12 3 3.5 7.5 12 12l8.5-4.5zM3.5 7.5v9L12 21l8.5-4.5v-9M12 12v9']],
  scan: [['path', 'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M7 12h10']],
  orders: [['path', 'M9 3.5h6v3H9zM7.5 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1.5M8 12h8M8 16h5']],
  more: [['circle', { cx: 5.5, cy: 12, r: 1.2 }], ['circle', { cx: 12, cy: 12, r: 1.2 }], ['circle', { cx: 18.5, cy: 12, r: 1.2 }]],
  user: [['circle', { cx: 12, cy: 8, r: 4 }], ['path', 'M4.5 20.5a7.5 7.5 0 0 1 15 0']],
  users: [['circle', { cx: 9, cy: 8, r: 3.5 }], ['path', 'M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8']],
  logout: [['path', 'M9.5 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h3M15.5 16.5L20 12l-4.5-4.5M20 12H9.5']],
  right: [['path', 'M9.5 6l6 6-6 6']],
  back: [['path', 'M19 12H5M11 6l-6 6 6 6']],
  refresh: [['path', 'M20 11a8 8 0 0 0-14.6-4.5L4 8M4 3.5V8h4.5M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20.5V16h-4.5']],
  sparkle: [['path', 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z']],
  plus: [['path', 'M12 5v14M5 12h14']],
  send: [['path', 'M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z']],
  edit: [['path', 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4']],
  crown: [['path', 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z']],
  whatsapp: [['path', 'M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.1-4.2A8.5 8.5 0 1 1 20.5 12z'], ['path', 'M9 8.5c0 3.5 2.6 6.5 6.5 6.5l1-1.6-2-1-1 1c-1.4-.6-2.4-1.6-3-3l1-1-1-2L9 8.5z']],
  share: [['path', 'M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6']],
  search: [['circle', { cx: 11, cy: 11, r: 6.5 }], ['path', 'M20 20l-4.2-4.2']],
  userplus: [['circle', { cx: 10, cy: 8, r: 4 }], ['path', 'M3 20.5a7 7 0 0 1 12.5-4.3M19 14v6M16 17h6']],
  folder: [['path', 'M3 6h6l2 2h10v11H3z']],
  tag: [['path', 'M3 12V4h8l10 10-8 8L3 12z'], ['circle', { cx: 7.5, cy: 7.5, r: 1.5 }]],
  trash: [['path', 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13']],
  grip: [['circle', { cx: 9, cy: 6, r: 1.3 }], ['circle', { cx: 15, cy: 6, r: 1.3 }], ['circle', { cx: 9, cy: 12, r: 1.3 }], ['circle', { cx: 15, cy: 12, r: 1.3 }], ['circle', { cx: 9, cy: 18, r: 1.3 }], ['circle', { cx: 15, cy: 18, r: 1.3 }]],
  up: [['path', 'M6 15l6-6 6 6']],
  down: [['path', 'M6 9l6 6 6-6']],
  image: [['rect', { x: 3.5, y: 4.5, width: 17, height: 15, rx: 2 }], ['circle', { cx: 9, cy: 10, r: 1.6 }], ['path', 'M20.5 16l-5-5-8.5 8.5']],
  camera: [['path', 'M4 8h3l1.5-2h7L17 8h3v11H4z'], ['circle', { cx: 12, cy: 13.5, r: 3.5 }]],
  pdf: [['path', 'M6 3h9l4 4v14H6z'], ['path', 'M14 3v5h5M9 13h6M9 17h4']],
  history: [['path', 'M3 12a9 9 0 1 0 3-6.7L3 8'], ['path', 'M3 3v5h5M12 7v5l3 2']],
  // Module 4
  barcode: [['path', 'M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12']],
  list: [['rect', { x: 3.5, y: 5, width: 5, height: 5, rx: 1.2 }], ['rect', { x: 3.5, y: 14, width: 5, height: 5, rx: 1.2 }], ['path', 'M11.5 7.5h9M11.5 16.5h9']],
  grid: [['rect', { x: 4, y: 4, width: 6.5, height: 6.5, rx: 1.5 }], ['rect', { x: 13.5, y: 4, width: 6.5, height: 6.5, rx: 1.5 }], ['rect', { x: 4, y: 13.5, width: 6.5, height: 6.5, rx: 1.5 }], ['rect', { x: 13.5, y: 13.5, width: 6.5, height: 6.5, rx: 1.5 }]],
  undo: [['path', 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11']],
  skip: [['path', 'M5 5l9 7-9 7V5zM18 5v14']],
  keyboard: [['rect', { x: 2.5, y: 6, width: 19, height: 12, rx: 2 }], ['path', 'M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10']],
  star: [['path', 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5z']],
  move: [['path', 'M5 12h14M15 8l4 4-4 4M9 5H5v14h4']],
  broken: [['path', 'M3 12V4h8l3 3-3 3 3 3-3 3 3 3-1 1L3 12zM15 9l6 6-6 6']],
  flash: [['path', 'M13 2L4 14h7l-1 8 9-12h-7l1-8z']],
  zoom: [['circle', { cx: 11, cy: 11, r: 6.5 }], ['path', 'M20 20l-4.2-4.2M11 8.5v5M8.5 11h5']],
  upload: [['path', 'M12 16V4M7 9l5-5 5 5M5 20h14']],
  crop: [['path', 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14']],
  layers: [['path', 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5']],
  sliders: [['path', 'M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1'], ['circle', { cx: 15, cy: 6.5, r: 2 }], ['circle', { cx: 9, cy: 12, r: 2 }], ['circle', { cx: 17, cy: 17.5, r: 2 }]],
  cloud: [['path', 'M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4.3 4.3 0 0 1-.5 8.5H7z']],
  // Module 5: paying, invoices, the counter.
  cash: [['rect', { x: 2.5, y: 6, width: 19, height: 12, rx: 2 }], ['circle', { cx: 12, cy: 12, r: 2.6 }], ['path', 'M6 9.5v5M18 9.5v5']],
  upi: [['path', 'M7 4l5 16M12 4l5 16'], ['path', 'M4 12h16']],
  card: [['rect', { x: 2.5, y: 5.5, width: 19, height: 13, rx: 2 }], ['path', 'M2.5 10h19M6.5 15h4']],
  receipt: [['path', 'M6 3h12v18l-3-2-3 2-3-2-3 2V3z'], ['path', 'M9 8h6M9 12h6M9 16h3']],
  print: [['path', 'M7 9V3h10v6'], ['rect', { x: 3.5, y: 9, width: 17, height: 8, rx: 2 }], ['path', 'M7 14h10v7H7z']],
  xcircle: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', 'M9 9l6 6M15 9l-6 6']],
  percent: [['path', 'M19 5L5 19'], ['circle', { cx: 7, cy: 7, r: 2.5 }], ['circle', { cx: 17, cy: 17, r: 2.5 }]],
  store: [['path', 'M3.5 9l1.5-5h14l1.5 5M3.5 9v11h17V9M3.5 9h17M9 20v-6h6v6']],
  // Module 6: periods, the sales summary, the Excel file.
  calendar: [['rect', { x: 3.5, y: 5, width: 17, height: 15.5, rx: 2 }], ['path', 'M3.5 10h17M8 3v4M16 3v4']],
  chart: [['path', 'M4 20V10M10 20V4M16 20v-7M22 20H2']],
  sheet: [['rect', { x: 3.5, y: 3.5, width: 17, height: 17, rx: 2 }], ['path', 'M3.5 9.5h17M3.5 15h17M9.5 3.5v17']],
  // Module 11: app updates.
  download: [['path', 'M12 4v11M7 10.5l5 5 5-5M5 20h14']],
};

export function Icon({ name, size = 22, color = '#000', strokeWidth = 1.8 }) {
  const shapes = SHAPES[name] || SHAPES.info;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {shapes.map(([kind, props], i) => {
        if (kind === 'path') return <Path key={i} d={props} />;
        if (kind === 'rect') return <Rect key={i} {...props} />;
        return <Circle key={i} {...props} fill={props.r < 2 ? color : 'none'} />;
      })}
    </Svg>
  );
}
