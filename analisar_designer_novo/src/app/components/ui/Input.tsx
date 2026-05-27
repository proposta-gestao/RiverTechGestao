import { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm text-[#a0a0a0]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-[rgba(229,178,93,0.2)]',
            'text-white placeholder:text-[#808080]',
            'focus:outline-none focus:ring-2 focus:ring-[#E5B25D]/50 focus:border-[#E5B25D]',
            'transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-[#FF4757] focus:ring-[#FF4757]/50',
            className
          )}
          {...props}
        />
        {error && (
          <span className="text-sm text-[#FF4757]">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
