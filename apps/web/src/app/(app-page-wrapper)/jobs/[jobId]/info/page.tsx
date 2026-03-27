 "use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { SelectField, SearchableSelectField } from "@onehash/ui/select";
import { Separator } from "@onehash/ui/separator";
import { Country, City } from "country-state-city";
import { useJobSetup } from "../context";
import {
  employmentTypes,
  workplaceTypes,
  salaryTypes,
  timeframes,
  CITY_VALUE_SEP,
  getCityDisplayName,
  type SalaryType,
} from "../constants";
import { useTranslation } from "react-i18next";
import {
  getBasicInfoValidation,
  getHiringDetailsValidation,
} from "../../../../../lib/validations/setupValidation";
import { getJobCategories, type JobCategoryResponse } from "@/api";

const uniqueCurrencies = (() => {
  const set = new Set<string>();
  Country.getAllCountries().forEach((c) => c.currency && set.add(c.currency));
  return [...set].sort();
})();

export default function JobInfoPage() {
  const { t } = useTranslation();
  const [countrySearch, setCountrySearch] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [minTouched, setMinTouched] = useState(false);
  const [maxTouched, setMaxTouched] = useState(false);
  const [categories, setCategories] = useState<JobCategoryResponse[]>([]);
  const {
    title,
    setTitle,
    basicInfoAttemptedNext,
    category,
    setCategory,
    employmentType,
    setEmploymentType,
    workplaceType,
    setWorkplaceType,
    country,
    city,
    setCity,
    citySearch,
    setCitySearch,
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
    hiringDetailsAttemptedSave,
    handleCountryChange,
  } = useJobSetup();

  const countries = useMemo(() => Country.getAllCountries(), []);
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countries;
    const q = countrySearch.toLowerCase();
    return countries.filter((c) => c.name.toLowerCase().includes(q));
  }, [countries, countrySearch]);

  const cities = useMemo(
    () => (country ? (City.getCitiesOfCountry(country) ?? []) : []),
    [country],
  );
  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return cities;
    const q = citySearch.toLowerCase();
    return cities.filter((c) => c.name.toLowerCase().includes(q));
  }, [cities, citySearch]);

  const needsLocation = workplaceType === "hybrid" || workplaceType === "onsite";

  const titleError = useMemo(() => {
    if (!titleTouched && !basicInfoAttemptedNext) return undefined;
    const { valid, titleError: err } = getBasicInfoValidation({
      title,
      workplaceType,
      country,
      city,
    });
    if (valid || !err) return undefined;
    if (err === "min") return t("min_char_length", { count: 1 });
    if (err === "max") return t("max_char_length", { count: 100 });
    return t("job_name_invalid");
  }, [title, titleTouched, basicInfoAttemptedNext, workplaceType, country, city, t]);

  const locationHint = useMemo(() => {
    if (!basicInfoAttemptedNext || !needsLocation) return undefined;
    const { valid, locationError } = getBasicInfoValidation({
      title,
      workplaceType,
      country,
      city,
    });
    if (valid || !locationError) return undefined;
    return t("location_required_hybrid_onsite");
  }, [basicInfoAttemptedNext, needsLocation, title, workplaceType, country, city, t]);

  const hiringValidation = useMemo(
    () =>
      getHiringDetailsValidation({
        salaryType,
        salaryFixed,
        salaryMin,
        salaryMax,
      }),
    [salaryType, salaryFixed, salaryMin, salaryMax],
  );
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

  useEffect(() => {
    getJobCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <InputField
        value={title}
        label={t("job_title")}
        showAsterisk
        onChange={(e) => {
          setTitle(e.target.value);
          if (e.target.value.trim()) setTitleTouched(false);
        }}
        onBlur={() => setTitleTouched(true)}
        error={titleError}
        placeholder="e.g. Senior Frontend Engineer"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField
          label="Job Categories"
          value={category}
          onValueChange={setCategory}
          options={categories.map((c) => ({ value: c.name, label: c.name }))}
          placeholder={t("select")}
        />
        <SelectField
          label={t("employment_type")}
          value={employmentType}
          onValueChange={setEmploymentType}
          options={employmentTypes.map((type) => ({ value: type, label: t(type) }))}
          placeholder={t("select")}
        />
      </div>
      <SelectField label={t("workplace_type")}>
        <div className="flex gap-1.5">
          {workplaceTypes.map((type) => (
            <Button
              key={type}
              type="button"
              variant={workplaceType === type ? "default" : "outline"}
              size="sm"
              className="flex-1 h-9 text-xs capitalize"
              onClick={() => setWorkplaceType(type)}
            >
              {t(type)}
            </Button>
          ))}
        </div>
      </SelectField>
      <Separator />
      <SelectField label={t("salary")}>
        <div className="flex gap-1.5">
          {salaryTypes.map((type: SalaryType) => (
            <Button
              key={type}
              type="button"
              variant={salaryType === type ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs flex-1"
              onClick={() => setSalaryType(type)}
            >
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
            <p className="text-xs text-destructive">
              Minimum salary must be less than or equal to maximum.
            </p>
          )}
        </>
      )}
      {needsLocation ? (
        <div className="space-y-1.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelectField
              label={t("country")}
              value={country}
              onValueChange={handleCountryChange}
              placeholder={t("select")}
              options={filteredCountries.map((c) => ({ value: c.isoCode, label: c.name }))}
              searchPlaceholder={t("search_country")}
              searchValue={countrySearch}
              onSearchChange={setCountrySearch}
              noResultsText={t("no_results")}
              showAsterisk
            />
            <SearchableSelectField
              label={t("city")}
              value={city}
              onValueChange={setCity}
              placeholder={country ? t("select") : t("select_country_first")}
              disabled={!country}
              options={filteredCities.map((c) => ({
                value: `${c.name}${CITY_VALUE_SEP}${c.stateCode}`,
                label: c.stateCode ? `${c.name} (${c.stateCode})` : c.name,
              }))}
              getDisplayValue={getCityDisplayName}
              searchPlaceholder={t("search_city")}
              searchValue={citySearch}
              onSearchChange={setCitySearch}
              noResultsText={t("no_results")}
              typeToNarrowText={t("type_to_narrow")}
              maxOptions={200}
              showAsterisk
            />
          </div>
          {locationHint ? <p className="text-xs text-destructive">{locationHint}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
