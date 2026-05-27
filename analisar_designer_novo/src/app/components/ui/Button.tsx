import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-200',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-gradient-to-r from-[#E5B25D] to-[#d4a14c] text-[#0d0d0d] hover:shadow-lg hover:shadow-[#E5B25D]/20':
              variant === 'primary',
            'bg-[#222222] text-white hover:bg-[#2a2a2a]': variant === 'secondary',
            'border border-[rgba(229,178,93,0.2)] text-[#E5B25D] hover:bg-[#E5B25D]/10':
              variant === 'outline',
            'text-[#a0a0a0] hover:text-white hover:bg-[#222222]': variant === 'ghost',
            'bg-[#FF4757] text-white hover:bg-[#ff3545]': variant === 'danger',
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2.5 text-base': size === 'md',
            'px-6 py-3 text-lg': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
