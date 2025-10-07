import { validateUnitEconomics as validateUnitEconomicsCore } from "./validationFramework";
import type { UnitEconomicsValidation } from "./validationFramework";
import type { UnitEconomicsOptions } from "./financialValidator";

export type { UnitEconomicsValidation };

export function validateUnitEconomics(
  pricing: number,
  cac: number,
  churnRate = 0.05,
  options: Partial<UnitEconomicsOptions> = {}
): UnitEconomicsValidation {
  return validateUnitEconomicsCore(pricing, cac, churnRate, options);
}

export default validateUnitEconomics;
