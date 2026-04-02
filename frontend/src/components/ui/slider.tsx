import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '@/lib/utils';

// Simple slider using native input range
interface SliderProps {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  className?: string;
  disabled?: boolean;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, defaultValue, min = 0, max = 100, step = 1, onValueChange, disabled }, ref) => {
    const currentValue = value?.[0] ?? defaultValue?.[0] ?? min;
    return (
      <div className={cn('relative flex w-full touch-none select-none items-center', className)}>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          disabled={disabled}
          onChange={(e) => onValueChange?.([Number(e.target.value)])}
          className="w-full h-2 rounded-full bg-secondary accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    );
  }
);
Slider.displayName = 'Slider';

export { Slider };
