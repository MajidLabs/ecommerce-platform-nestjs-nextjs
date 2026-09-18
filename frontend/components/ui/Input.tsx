import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`rounded border px-3 py-2.5 text-sm bg-white text-ink placeholder:text-muted/60 focus:border-signal transition-colors ${error ? 'border-brick' : 'border-line'} ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-brick">{error}</span>}
      </div>
    );
  },
);
Input.displayName = 'Input';
