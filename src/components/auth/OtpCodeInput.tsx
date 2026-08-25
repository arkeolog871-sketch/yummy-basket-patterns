import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { OTP_CODE_LENGTH, normalizeOtpCode } from "@/lib/otp";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  value: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
};

/** 6 haneli sayısal OTP kutuları: yapıştırma, boşluk ve harf girişini temizler. */
export function OtpCodeInput({ id, value, disabled, autoFocus, onChange, onComplete }: Props) {
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
      aria-label="6 haneli e-posta doğrulama kodu"
      autoFocus={autoFocus}
      disabled={disabled}
      value={value}
      pasteTransformer={(pasted) => normalizeOtpCode(pasted)}
      onChange={(next) => onChange(normalizeOtpCode(next))}
      onComplete={(next) => onComplete?.(normalizeOtpCode(next))}
      containerClassName="flex justify-center gap-1.5 sm:gap-2"
    >
      <InputOTPGroup className="gap-1.5 sm:gap-2">
        {Array.from({ length: OTP_CODE_LENGTH }, (_, index) => (
          <InputOTPSlot
            key={index}
            index={index}
            className={cn(
              "h-11 w-10 rounded-md border border-input text-base first:rounded-md last:rounded-md sm:h-12 sm:w-11",
            )}
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
