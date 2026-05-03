interface Props {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
}

export function Sparkline({
  values,
  width = 120,
  height = 28,
  stroke = "currentColor",
}: Props) {
  if (values.length < 2) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }
  const min = 0;
  const max = 100;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / (max - min)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="morale history"
    >
      <line
        x1="0"
        x2={width}
        y1={height / 2}
        y2={height / 2}
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeDasharray="2 3"
      />
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
