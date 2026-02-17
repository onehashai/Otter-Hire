import { z } from "zod";

export const jobNameSchema = z.object({
  jobName: z
    .string()
    .trim()
    .min(1, "min")
    .max(100, "max")
    .regex(/^[A-Za-z0-9\s\-&'/+.()]+$/, "invalid"),
});

export type JobNameFormValues = z.infer<typeof jobNameSchema>;

export const onboardingSchema = z.object({
  fullName: z.string().trim().min(1, "Please enter your full name"),
  organization: z.string().trim().min(1, "Please enter your organization name"),
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Please enter your email").email("Please enter a valid email"),
  password: z.string().min(1, "Please enter your password"),
  remember: z.boolean().optional(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

const signupPasswordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Z]/, "One uppercase letter")
  .regex(
    /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
    "One number or symbol"
  );

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(1, "Please enter your full name"),
    email: z.string().trim().min(1, "Please enter your email").email("Please enter a valid email"),
    password: signupPasswordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    company: z.string().trim().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupFormValues = z.infer<typeof signupSchema>;
