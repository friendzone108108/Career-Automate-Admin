'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';

interface SwitchProps {
    checked?: boolean;
    onChange?: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
}

export function Switch({ checked = false, onChange, disabled = false, className }: SwitchProps) {
    const [isChecked, setIsChecked] = useState(checked);

    const handleClick = () => {
        if (disabled) return;
        const newValue = !isChecked;
        setIsChecked(newValue);
        onChange?.(newValue);
    };

    return (
        <button
            type="button"
            role="switch"
            aria-checked={isChecked}
            disabled={disabled}
            onClick={handleClick}
            className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                isChecked ? 'bg-blue-600' : 'bg-gray-200',
                disabled && 'opacity-50 cursor-not-allowed',
                className
            )}
        >
            <span
                className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    isChecked ? 'translate-x-5' : 'translate-x-0'
                )}
            />
        </button>
    );
}
