type NumberPopProps = {
  value: number | string;
  className?: string;
};

export function NumberPop({ value, className = "" }: NumberPopProps) {
  const text = String(value);

  return (
    <span className={`t-digit-group is-animating ${className}`.trim()} aria-label={text}>
      {Array.from(text).map((digit, index) => (
        <span
          aria-hidden="true"
          className="t-digit"
          data-stagger={String(Math.min(index, 8))}
          key={`${digit}-${index}`}
        >
          {digit}
        </span>
      ))}
    </span>
  );
}
