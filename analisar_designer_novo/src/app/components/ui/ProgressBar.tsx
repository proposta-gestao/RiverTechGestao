import { clsx } from 'clsx';

interface ProgressBarProps {
  value: number;
  max: number;
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({ value, max, showLabel = true, className }: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const isWarning = percentage > 70 && percentage < 90;
  const isDanger = percentage >= 90;

  return (
    <div className={clsx('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[#a0a0a0]">
            R$ {value.toFixed(2).replace('.', ',')} / R$ {max.toFixed(2).replace('.', ',')}
          </span>
          <span className={clsx(
            'font-medium',
            isDanger && 'text-[#FF4757]',
            isWarning && 'text-[#FDCB6E]',
            !isWarning && !isDanger && 'text-[#00B894]'
          )}>
            {percentage.toFixed(0)}%
          </span>
        </div>
      )}
      <div className="h-2 bg-[#222222] rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full transition-all duration-500 rounded-full',
            isDanger && 'bg-gradient-to-r from-[#FF4757] to-[#ff3545]',
            isWarning && 'bg-gradient-to-r from-[#FDCB6E] to-[#f4c150]',
            !isWarning && !isDanger && 'bg-gradient-to-r from-[#E5B25D] to-[#d4a14c]'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
