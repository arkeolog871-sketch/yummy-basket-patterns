import { z } from "zod";

export const otpSendSchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta adresi girin").max(255),
  allowSignUp: z.boolean().optional(),
  purpose: z.enum(["login", "signup"]).optional(),
});

export const otpVerifySchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta adresi girin").max(255),
  code: z.union([z.string(), z.number()]),
  termsAccepted: z.boolean().optional().default(false),
});

export const sendOtpSchema = otpSendSchema;
export const verifyOtpSchema = otpVerifySchema;

export const registerSchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta adresi girin").max(255),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı").max(72),
  fullName: z.string().trim().min(2, "Ad soyad girin").max(120),
  phone: z.string().trim().min(10, "Telefon numarası en az 10 haneli olmalı").max(20),
});
