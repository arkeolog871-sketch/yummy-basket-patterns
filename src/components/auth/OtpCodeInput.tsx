import { useEffect, useState } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { OTP_CODE_LENGTH, isCompleteOtpCode, normalizeOtpCode } from "@/lib/otp";
import { isIosDevice } from "@/lib/ios";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  value: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
};

/**
 * Android/web: 6 kutulu input-otp.
 * iOS Safari / Web Clip: tek görünür alan — one-time-code, önde sıfır, yapıştırma.
 */
export function OtpCodeInput({ id, value, disabled, autoFocus, onChange, onComplete }: Props) {
  const [ios, setIos] = useState(false);
  useEffect(() => {
    setIos(isIosDevice());
  }, []);

  if (ios) {
    return (
      <input
        id={id}
        name="one-time-code"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-label="6 haneli e-posta doğrulama kodu"
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        maxLength={OTP_CODE_LENGTH}
        onChange={(event) => {
          const next = normalizeOtpCode(event.target.value);
          onChange(next);
          if (isCompleteOtpCode(next)) onComplete?.(next);
        }}
        className="flex h-12 w-full rounded-md border border-input bg-transparent px-3 text-center text-[16px] font-semibold tracking-[0.4em] tabular-nums shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
    );
  }

  return (
    <InputOTP
      id={id}
      name="one-time-code"
      maxLength={OTP_CODE_LENGTH}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="done"
      aria-label="6 haneli e-posta doğrulama kodu"
      autoFocus={autoFocus}
      disabled={disabled}
      value={value}
      pasteTransformer={(pasted) => normalizeOtpCode(pasted)}
      onChange={(next) => onChange(normalizeOtpCode(next))}
      onComplete={(next) => onComplete?.(normalizeOtpCode(next))}
      className="text-[16px]"
      containerClassName="flex w-full justify-center gap-1.5 sm:gap-2"
    >
      <InputOTPGroup className="w-full max-w-sm justify-center gap-1.5 sm:gap-2">
        {Array.from({ length: OTP_CODE_LENGTH }, (_, index) => (
          <InputOTPSlot
            key={index}
            index={index}
            className={cn(
              "h-12 min-h-12 w-9 min-w-0 flex-1 rounded-md border border-input text-[16px] font-semibold tabular-nums first:rounded-md last:rounded-md sm:h-12 sm:max-w-11 sm:flex-none sm:w-11",
            )}
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
