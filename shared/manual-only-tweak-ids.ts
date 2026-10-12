/**
 * Tweaks that must never be included in an automatic recommendation or
 * bulk-apply action. They remain available for an informed manual choice.
 */
export const MANUAL_ONLY_TWEAK_IDS: ReadonlySet<string> = new Set([
  "ServiceTabletInput", "ProcSvc_TabletInput", "ProcSvc_BthServ",
  "ProcSvc_XboxGip", "WinTitusRazerBlock",
  "ProcSvc_WbioSrvc", "ProcSvc_EapHost", "ProcSvc_seclogon",
  "ProcSvc_AppReadiness", "ProcSvc_W32Time", "ProcSvc_BITS",
  "ProcSvc_SharedAccess", "ProcSvc_WFDSConMgr", "ProcSvc_icssvc",
  "ServiceWbioSrvc", "ServicePrintSpooler", "WinTitusXboxComponents",
  "WinTitusEdgeRemove", "DisableSearchIndexing",
  "ServiceWSearch", "ProcSvc_WSearch", "DisableSearchIndexer",
  "WinTitusDiskCleanup",
  "FiveMCacheClear",
  "FiveMFixProductId",
  "OpenMsiUtilityPro",
  "DisableSearchIndexing",
  "CodDisableHAGS",
  "FiveM1060DisableHAGS",
  "FiveM1650DisableHAGS",
  "FiveM1650HAGSOffPack",
  "EnableHAGS",
  "FiveM5060EnableHAGS",
  "IGpu_DisableHAGSForIGpu",
  "Lap_DisableHAGS",
]);