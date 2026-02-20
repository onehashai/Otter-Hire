"use client";

import { useState } from "react";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Separator } from "@onehash/ui/separator";
import { SelectField } from "@onehash/ui/select";
import { Country } from "country-state-city";

import { useJobSetup } from "../context";
import { type SalaryType, salaryTypes, timeframes } from "../constants";
import { useTranslation } from "react-i18next";
import { getHiringDetailsValidation } from "../../../../../lib/validations/setupValidation";

const uniqueCurrencies = (() => {
  const set = new Set<string>();
  Country.getAllCountries().forEach((c) => c.currency && set.add(c.currency));
  return [...set].sort();
})();

export default function HiringDetailsPage() {
  const { t } = useTranslation();
  const [amountTouched, setAmountTouched] = useState(false);
  const [minTouched, setMinTouched] = useState(false);
  const [maxTouched, setMaxTouched] = useState(false);
  const {
    openings,
    setOpenings,
    salaryType,
    setSalaryType,
    salaryFixed,
    setSalaryFixed,
    salaryMin,
    setSalaryMin,
    salaryMax,
    setSalaryMax,
    currency,
    setCurrency,
    timeframe,
    setTimeframe,
    pipeline,
    setPipeline,
    country,
    city,
    hiringDetailsAttemptedSave,
  } = useJobSetup();

  const hiringValidation = getHiringDetailsValidation({
    salaryType,
    salaryFixed,
    salaryMin,
    salaryMax,
  });
  const amountError =
    hiringValidation.amountError && (amountTouched || hiringDetailsAttemptedSave)
      ? t("required")
      : undefined;
  const minError =
    hiringValidation.minError && (minTouched || hiringDetailsAttemptedSave)
      ? t("required")
      : undefined;
  const maxError =
    hiringValidation.maxError && (maxTouched || hiringDetailsAttemptedSave)
      ? t("required")
      : undefined;

  return (
    <div className="space-y-5">
      <InputField
        label={t("openings")}
        type="number"
        min={1}
        value={openings}
        onChange={(e) => setOpenings(Number(e.target.value))}
        className="h-9 text-sm max-w-[120px]"
      />
      <Separator />
      <SelectField label={t("salary")}>
        <div className="flex gap-1.5">
          {salaryTypes.map((type: SalaryType) => (
            <Button
              key={type}
              type="button"
              variant={salaryType === type ? "default" : "outline"} size="sm" className="h-9 text-xs flex-1" onClick={() => setSalaryType(type)}>
              {t(type)}
            </Button>
          ))}
        </div>
      </SelectField>
      {salaryType === "fixed" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InputField
            label={t("amount")}
            value={salaryFixed}
            onChange={(e) => setSalaryFixed(e.target.value)}
            onBlur={() => setAmountTouched(true)}
            error={amountError}
            placeholder="e.g. 150000"
            className="h-9 text-sm"
            type="number"
            showAsterisk
          />
          <SelectField
            label={t("currency")}
            value={currency}
            onValueChange={setCurrency}
            options={uniqueCurrencies.map((curr) => ({ value: curr, label: curr }))}
            placeholder={t("select")}
          />
          <SelectField
            label={t("timeframe")}
            value={timeframe}
            onValueChange={setTimeframe}
            options={timeframes.map((tf) => ({ value: tf, label: t(tf) }))}
            placeholder={t("select")}
          />
        </div>
      )}
      {salaryType === "range" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label={t("minimum")}
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              onBlur={() => setMinTouched(true)}
              error={minError}
              placeholder="e.g. 140000"
              className="h-9 text-sm"
              type="number"
              showAsterisk
            />
            <InputField
              label={t("maximum")}
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              onBlur={() => setMaxTouched(true)}
              error={maxError}
              placeholder="e.g. 180000"
              className="h-9 text-sm"
              type="number"
              showAsterisk
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label={t("currency")}
              value={currency}
              onValueChange={setCurrency}
              options={uniqueCurrencies.map((curr) => ({ value: curr, label: curr }))}
              placeholder={t("select")}
            />
            <SelectField
              label={t("timeframe")}
              value={timeframe}
              onValueChange={setTimeframe}
              options={timeframes.map((tf) => ({ value: tf, label: t(tf) }))}
            placeholder={t("select")}
            />
          </div>
          {salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax) && (
            <p className="text-xs text-destructive">Minimum salary must be less than or equal to maximum.</p>
          )}
        </>
      )}
      <Separator />
      <SelectField
        label={t("interview_pipeline_template")}
        value={pipeline}
        onValueChange={setPipeline}
        options={[
          { value: "standard", label: t("standard") },
          { value: "fast", label: t("fast") },
          { value: "executive", label: t("executive") },
        ]}
        placeholder={t("select")}
      />
    </div>
  );
}
