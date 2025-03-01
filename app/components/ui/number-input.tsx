import { MinusIcon, PlusIcon } from 'lucide-react';
import { Button } from '#app/components/ui/button.tsx';
import { Input } from '#app/components/ui/input.tsx';
import { cn } from '#app/lib/utils.ts';

interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  controls?: boolean;
  className?: string;
  inputClassName?: string;
}

export function NumberInput({
                              value,
                              onChange,
                              min = 0,
                              max = Infinity,
                              step = 1,
                              controls = true,
                              className,
                              inputClassName,
                              disabled,
                              ...props
                            }: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const newValue = inputValue === '' ? null : parseFloat(inputValue);

    if (newValue === null || !isNaN(newValue)) {
      onChange(newValue === null ? null : clamp(newValue, min, max));
    }
  };

  const increment = () => {
    if (value === null) {
      onChange(clamp(min, min, max));
    } else {
      onChange(clamp(value + step, min, max));
    }
  };

  const decrement = () => {
    if (value === null) {
      onChange(clamp(min, min, max));
    } else {
      onChange(clamp(value - step, min, max));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      increment();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      decrement();
    }
  };

  return (
    <div className={cn('flex items-center', className)}>
      {controls && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-r-none"
          onClick={decrement}
          disabled={disabled || (value !== null && value <= min)}
        >
          <MinusIcon className="h-4 w-4" />
        </Button>
      )}
      <Input
        type="number"
        value={value === null ? '' : value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={cn(
          controls &&
          'rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          inputClassName
        )}
        {...props}
      />
      {controls && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-l-none"
          onClick={increment}
          disabled={disabled || (value !== null && value >= max)}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// Helper function to clamp a value between min and max
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
