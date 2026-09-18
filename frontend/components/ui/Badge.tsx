import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'signal' | 'brick' | 'muted';
}

const tones = {
  neutral: 'bg-line/50 text-ink',
  signal: 'bg-signal/10 text-signal-dark',
  brick: 'bg-brick/10 text-brick',
  muted: 'bg-transparent text-muted border border-line',
};

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium tabular-nums ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
