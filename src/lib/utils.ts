import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

export function formatDateTime(date: string | Date): string {
    return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function getExpiryStatus(expiryDate: string | Date | null): { text: string; variant: 'default' | 'warning' | 'danger' } {
    if (!expiryDate) return { text: 'No expiry', variant: 'default' };

    const expiry = new Date(expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
        return { text: 'Expired', variant: 'danger' };
    } else if (daysUntilExpiry <= 7) {
        return { text: `Expires in ${daysUntilExpiry} days`, variant: 'danger' };
    } else if (daysUntilExpiry <= 30) {
        return { text: `Expires in ${daysUntilExpiry} days`, variant: 'warning' };
    } else {
        return { text: `Expires in ${daysUntilExpiry} days`, variant: 'default' };
    }
}
