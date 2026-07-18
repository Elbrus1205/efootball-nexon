interface AnimatedCounterProps {
  value: number;
  className?: string;
}

export function AnimatedCounter({ value, className }: AnimatedCounterProps) {
  return <span className={className}>{new Intl.NumberFormat("ru-RU").format(value)}</span>;
}
