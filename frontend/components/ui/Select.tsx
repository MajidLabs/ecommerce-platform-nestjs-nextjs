import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, className = '', id, children, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`rounded border border-line px-3 py-2.5 text-sm bg-white text-ink focus:border-signal transition-colors ${className}`}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  },
);
Select.displayName = 'Select';
