'use client';

import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface SelectOption {
    value: string;
    label: string;
}

interface SelectProps {
    options: SelectOption[];
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    label?: string;
    className?: string;
}

export function Select({ options, value, onChange, placeholder = 'Select...', label, className }: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedValue, setSelectedValue] = useState(value || '');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionValue: string) => {
        setSelectedValue(optionValue);
        onChange?.(optionValue);
        setIsOpen(false);
    };

    const selectedOption = options.find(opt => opt.value === selectedValue);

    return (
        <div className={cn('w-full', className)} ref={ref}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {label}
                </label>
            )}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        'flex h-11 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                        'transition-all duration-200'
                    )}
                >
                    <span className={selectedOption ? 'text-gray-900' : 'text-gray-400'}>
                        {selectedOption?.label || placeholder}
                    </span>
                    <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
                </button>

                {isOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option.value)}
                                className={cn(
                                    'w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors',
                                    selectedValue === option.value && 'bg-blue-50 text-blue-600'
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
