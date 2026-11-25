import { z } from "zod";
import { checkFullName } from "@/lib/name-validation";

/** iOS otomatik büyük harfi e-posta eşleşmesini bozmasın. */
const authEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Geçerli bir e-posta adresi girin")
  .max(255);

export const otpSendSchema = z.object({
  email: authEmail,
  allowSignUp: z.boolean().optional(),
  purpose: z.enum(["login", "signup"]).optional(),
});

export const otpVerifySchema = z.object({
  email: authEmail,
  code: z.union([z.string(), z.number()]),
  termsAccepted: z.boolean().optional().default(false),
});

export const sendOtpSchema = otpSendSchema;
export const verifyOtpSchema = otpVerifySchema;

export const registerSchema = z.object({
  email: authEmail,
  password: z.string().min(6, "Şifre en az 6 karakter olmalı").max(72),
  fullName: z
    .string()
    .trim()
    .min(2, "Ad soyad girin")
    .max(120)
    .superRefine((value, ctx) => {
      const result = checkFullName(value);
      if (!result.ok) ctx.addIssue({ code: "custom", message: result.reason });
    }),
  phone: z
    .string()
    .trim()
    .min(10, "Telefon numarası en az 10 haneli olmalı")
    .max(20)
    .optional()
    .or(z.literal("")),
});
