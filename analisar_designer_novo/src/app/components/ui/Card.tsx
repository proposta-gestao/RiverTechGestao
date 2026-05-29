import { HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ glass = false, hover = false, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-2xl border transition-all duration-200',
          {
            'bg-[rgba(26,26,26,0.8)] backdrop-blur-sm border-[rgba(229,178,93,0.2)]': glass,
            'bg-[#1a1a1a] border-[rgba(229,178,93,0.2)]': !glass,
            'hover:bg-[#222222] hover:shadow-xl hover:shadow-black/40 cursor-pointer': hover,
          },
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
