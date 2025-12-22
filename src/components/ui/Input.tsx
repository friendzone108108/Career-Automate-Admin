import { cn } from '@/lib/utils';
import { forwardRef, InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, label, error, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {label}
                    </label>
                )}
                <input
                    type={type}
                    className={cn(
                        'flex h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm',
                        'placeholder:text-gray-400',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50',
                        'transition-all duration-200',
                        error && 'border-red-500 focus:ring-red-500',
                        className
                    )}
                    ref={ref}
                    {...props}
                />
                {error && (
                    <p className="mt-1 text-sm text-red-500">{error}</p>
                )}
            </div>
        );
    }
);
Input.displayName = 'Input';

export { Input };
