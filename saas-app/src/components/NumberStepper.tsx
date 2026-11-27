import type { CSSProperties } from 'react';

interface NumberStepperProps {
  value: string;
  onChange: (next: string) => void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  clearZeroOnFocus?: boolean;
  title?: string;
  inputStyle?: CSSProperties;
}

export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  decimals = 0,
  placeholder,
  disabled = false,
  readOnly = false,
  clearZeroOnFocus = false,
  title,
  inputStyle
}: NumberStepperProps) {
  const num = parseFloat(String(value).replace(',', '.'));
  const atual = Number.isNaN(num) ? 0 : num;

  function aplicarDelta(delta: number) {
    if (disabled || readOnly) return;
    let proximo = atual + delta;
    if (min !== undefined && proximo < min) proximo = min;
    if (max !== undefined && proximo > max) proximo = max;
    onChange(decimals > 0 ? proximo.toFixed(decimals) : String(Math.round(proximo)));
  }

  return (
    <div className="num-stepper" title={title}>
      <button
        type="button"
        className="num-stepper-btn"
        disabled={disabled || readOnly || (min !== undefined && atual <= min)}
        onClick={() => aplicarDelta(-step)}
        aria-label="Diminuir"
      >
        −
      </button>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        className="field-input num-stepper-input"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        style={inputStyle}
        onFocus={() => {
          if (clearZeroOnFocus && (value === '0.00' || value === '0' || value === '0,00')) {
            onChange('');
          }
        }}
        onBlur={() => {
          if (clearZeroOnFocus && !String(value).trim()) {
            onChange(decimals > 0 ? (0).toFixed(decimals) : '0');
          }
        }}
        onChange={(e) => {
          let v = e.target.value;
          if (clearZeroOnFocus && v.length > 1 && v.startsWith('0') && v[1] !== '.' && v[1] !== ',') {
            v = v.replace(/^0+/, '');
          }
          onChange(v);
        }}
      />
      <button
        type="button"
        className="num-stepper-btn"
        disabled={disabled || readOnly || (max !== undefined && atual >= max)}
        onClick={() => aplicarDelta(step)}
        aria-label="Aumentar"
      >
        +
      </button>
    </div>
  );
}
