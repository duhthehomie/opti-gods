import { PRO_VALIDATION_ACTION_IDS } from "@shared/pro-validation-actions";
import { getTweakCompatibility } from "./tweak-compatibility";

/** Only explicit Pro missing-tweak runs receive the unpromoted test actions. */
export function getProValidationActionIds(native: boolean, pro: boolean): string[] {
  return native && pro
    ? PRO_VALIDATION_ACTION_IDS.filter(id => getTweakCompatibility(id).ok)
    : [];
}
