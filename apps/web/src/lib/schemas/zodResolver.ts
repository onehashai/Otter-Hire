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
