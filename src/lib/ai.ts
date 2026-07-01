// -----------------------------------------------------------------------------
// AI service seam (v1 = deterministic).
//
// The spec asks for placeholder service functions for classifyOrder,
// generateSupplierInstruction, generateCustomerUpdateDraft and calculateRiskLevel.
// v1 implements them with the deterministic business logic in ./business/*.
// When we add AI later, swap the implementations here — the call sites do not
// change. Keep any AI call BEHIND a deterministic fallback so the portal never
// blocks on an AI outage.
// -----------------------------------------------------------------------------
export { classifyOrder } from './business/classify';
export { generateSupplierInstruction } from './business/supplier-instruction';
export { generateCustomerUpdateDraft } from './business/customer-update';
export { calculateRiskLevel } from './business/risk';

// Example of the intended future shape (not wired in v1):
//   export async function classifyOrderAI(input): Promise<ClassifyResult> {
//     try { return await callModel(...) } catch { return classifyOrder(input) }
//   }
