import { jobNameSchema } from "@/lib/schemas/zodResolver";
import type { JobSetupState } from "../../app/(app-page-wrapper)/jobs/[jobId]/context";
import type { SetupStepSlug } from "../../app/(app-page-wrapper)/jobs/[jobId]/constants";

export type BasicInfoValidation = {
  valid: boolean;
  titleError?: "min" | "max" | "invalid";
  locationError?: boolean;
};

export type HiringDetailsValidation = {
  valid: boolean;
  amountError?: boolean;
  minError?: boolean;
  maxError?: boolean;
};

export type FirstInvalidSection = {
  slug: SetupStepSlug;
  messageKey: string;
  messageParams?: Record<string, number>;
};

export function getBasicInfoValidation(
  state: Pick<JobSetupState, "title" | "workplaceType" | "country" | "city">,
): BasicInfoValidation {
  const result = jobNameSchema.safeParse({ jobName: state.title });
  if (!result.success) {
    const msg = result.error.errors[0]?.message as "min" | "max" | "invalid" | undefined;
    return { valid: false, titleError: msg ?? undefined };
  }
  if (state.workplaceType === "hybrid" || state.workplaceType === "onsite") {
    if (!state.country?.trim() || !state.city?.trim()) {
      return { valid: false, locationError: true };
    }
  }
  return { valid: true };
}

export function getHiringDetailsValidation(
  state: Pick<JobSetupState, "salaryType" | "salaryFixed" | "salaryMin" | "salaryMax">,
): HiringDetailsValidation {
  const { salaryType, salaryFixed, salaryMin, salaryMax } = state;
  if (salaryType !== "fixed" && salaryType !== "range") {
    return { valid: true };
  }
  if (salaryType === "fixed") {
    const valid = salaryFixed.trim() !== "";
    return { valid, amountError: !valid ? true : undefined };
  }
  const minEmpty = salaryMin.trim() === "";
  const maxEmpty = salaryMax.trim() === "";
  const minGtMax = !minEmpty && !maxEmpty && Number(salaryMin) > Number(salaryMax);
  const valid = !minEmpty && !maxEmpty && !minGtMax;
  return {
    valid,
    minError: minEmpty ? true : undefined,
    maxError: maxEmpty ? true : undefined,
  };
}

type SetupValidationState = Pick<
  JobSetupState,
  | "title"
  | "workplaceType"
  | "country"
  | "city"
  | "salaryType"
  | "salaryFixed"
  | "salaryMin"
  | "salaryMax"
>;

export function isSetupValid(state: SetupValidationState): boolean {
  return getBasicInfoValidation(state).valid && getHiringDetailsValidation(state).valid;
}

export function getFirstInvalidSection(state: SetupValidationState): FirstInvalidSection | null {
  const basic = getBasicInfoValidation(state);
  if (!basic.valid) {
    if (basic.titleError === "min") {
      return { slug: "info", messageKey: "min_char_length", messageParams: { count: 1 } };
    }
    if (basic.titleError === "max") {
      return { slug: "info", messageKey: "max_char_length", messageParams: { count: 100 } };
    }
    if (basic.titleError === "invalid") {
      return { slug: "info", messageKey: "job_name_invalid" };
    }
    if (basic.locationError) {
      return { slug: "info", messageKey: "location_required_hybrid_onsite" };
    }
    return { slug: "info", messageKey: "job_title_required" };
  }
  const hiring = getHiringDetailsValidation(state);
  if (!hiring.valid) {
    if (hiring.amountError) {
      return { slug: "info", messageKey: "required" };
    }
    if (hiring.minError) {
      return { slug: "info", messageKey: "required" };
    }
    if (hiring.maxError) {
      return { slug: "info", messageKey: "required" };
    }
  }
  return null;
}
