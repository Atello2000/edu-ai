/**
 * JetonIcon — hexagone SVG partagé, représentation visuelle d'un jeton.
 * Utilise currentColor — la couleur est héritée du parent ou passée via style/className.
 */
export default function JetonIcon({ size = 12, style }) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path
        d="M7 1.4 L11.6 4 V10 L7 12.6 L2.4 10 V4 Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="7" r="1.4" fill="currentColor" />
    </svg>
  );
}
