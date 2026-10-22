'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface ErrorMessageProps {
  message: string;
  className?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorMessage({
  message,
  className,
  onRetry,
  retryLabel = 'Try Again',
}: ErrorMessageProps) {
  return (
    <div className={cn('rounded-lg border border-red-500/20 bg-red-500/10 p-4', className)}>
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 text-red-400" />
        <div className="flex-1">
          <p className="text-sm text-red-400">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm font-medium text-red-400 underline hover:text-red-300 transition-colors"
            >
              {retryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
