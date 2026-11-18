import { z } from "zod";

/** Mirrors the API's Password::defaults(); the API stays the source of truth. */
export const passwordRule = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.")
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[0-9]/, "Add a number.")
  .regex(/[^A-Za-z0-9]/, "Add a symbol.");

export const emailRule = z.string().trim().min(1, "Email is required.").email("Enter a valid email address.").max(255);

export const loginSchema = z.object({
  email: emailRule,
  password: z.string().min(1, "Password is required."),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name.").max(100),
    email: emailRule,
    password: passwordRule,
    password_confirmation: z.string(),
  })
  .refine((d) => d.password === d.password_confirmation, { path: ["password_confirmation"], message: "Passwords do not match." });

export const resetSchema = z
  .object({ password: passwordRule, password_confirmation: z.string() })
  .refine((d) => d.password === d.password_confirmation, { path: ["password_confirmation"], message: "Passwords do not match." });

export const changePasswordSchema = z
  .object({ current_password: z.string().min(1, "Enter your current password."), password: passwordRule, password_confirmation: z.string() })
  .refine((d) => d.password === d.password_confirmation, { path: ["password_confirmation"], message: "Passwords do not match." });

export const addressSchema = z.object({
  name: z.string().trim().min(2, "Enter the recipient's name.").max(255),
  phone: z.string().trim().regex(/^[0-9+\-\s()]{6,30}$/, "Enter a valid phone number."),
  line1: z.string().trim().min(3, "Enter the street address.").max(255),
  line2: z.string().trim().max(255).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Enter the city.").max(100),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  postal_code: z.string().trim().regex(/^[A-Za-z0-9\-\s]{3,20}$/, "Enter a valid postal code."),
  country: z.string().length(2, "Choose a country."),
});

/** Only same-site paths are allowed after login, to prevent open redirects. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
