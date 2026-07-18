import areaData from "china-area-data";

export interface RegionOption {
  code: string;
  label: string;
}

const EXCLUDED_PROVINCE_CODES = new Set(["710000", "810000", "820000"]);

function toOptions(parentCode: string): RegionOption[] {
  return Object.entries(areaData[parentCode] ?? {}).map(([code, label]) => ({
    code,
    label,
  }));
}

function findCode(parentCode: string, label: string): string {
  return (
    toOptions(parentCode).find((option) => option.label === label)?.code ?? ""
  );
}

export function getProvinceOptions(): RegionOption[] {
  return toOptions("86").filter(
    (option) => !EXCLUDED_PROVINCE_CODES.has(option.code),
  );
}

export function getCityOptions(province: string): RegionOption[] {
  const provinceCode = findCode("86", province);

  return provinceCode ? toOptions(provinceCode) : [];
}

export function getDistrictOptions(
  province: string,
  city: string,
): RegionOption[] {
  const provinceCode = findCode("86", province);
  const cityCode = provinceCode ? findCode(provinceCode, city) : "";

  return cityCode ? toOptions(cityCode) : [];
}
