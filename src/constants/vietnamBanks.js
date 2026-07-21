// Phase 7B.3-FE — UI/UX enhancement
// Top 10 Vietnamese banks for the payout profile bank selector.
// Codes match VietQR /api/v2/banks exactly (do not remap).
// This list is used as a hard fallback if the VietQR API call fails or
// returns unexpected data. The live API response (when available) overrides
// these entries by code, but the order and the bank set stay identical.

export const PREFERRED_BANK_CODES = [
  "VCB",
  "BIDV",
  "ICB",
  "VBA",
  "TCB",
  "MB",
  "ACB",
  "VPB",
  "STB",
  "TPB",
];

const VIETQR_LOGO_BASE = "https://cdn.vietqr.io/img";

export const FALLBACK_BANKS = [
  {
    code: "VCB",
    shortName: "Vietcombank",
    name: "Ngân hàng TMCP Ngoại thương Việt Nam",
    logo: `${VIETQR_LOGO_BASE}/VCB.png`,
  },
  {
    code: "BIDV",
    shortName: "BIDV",
    name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
    logo: `${VIETQR_LOGO_BASE}/BIDV.png`,
  },
  {
    code: "ICB",
    shortName: "VietinBank",
    name: "Ngân hàng TMCP Công thương Việt Nam",
    logo: `${VIETQR_LOGO_BASE}/ICB.png`,
  },
  {
    code: "VBA",
    shortName: "Agribank",
    name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam",
    logo: `${VIETQR_LOGO_BASE}/VBA.png`,
  },
  {
    code: "TCB",
    shortName: "Techcombank",
    name: "Ngân hàng TMCP Kỹ thương Việt Nam",
    logo: `${VIETQR_LOGO_BASE}/TCB.png`,
  },
  {
    code: "MB",
    shortName: "MBBank",
    name: "Ngân hàng TMCP Quân đội",
    logo: `${VIETQR_LOGO_BASE}/MB.png`,
  },
  {
    code: "ACB",
    shortName: "ACB",
    name: "Ngân hàng TMCP Á Châu",
    logo: `${VIETQR_LOGO_BASE}/ACB.png`,
  },
  {
    code: "VPB",
    shortName: "VPBank",
    name: "Ngân hàng TMCP Việt Nam Thịnh Vượng",
    logo: `${VIETQR_LOGO_BASE}/VPB.png`,
  },
  {
    code: "STB",
    shortName: "Sacombank",
    name: "Ngân hàng TMCP Sài Gòn Thương Tín",
    logo: `${VIETQR_LOGO_BASE}/STB.png`,
  },
  {
    code: "TPB",
    shortName: "TPBank",
    name: "Ngân hàng TMCP Tiên Phong",
    logo: `${VIETQR_LOGO_BASE}/TPB.png`,
  },
];

export function buildBankLogoUrl(code) {
  if (!code) return "";
  return `${VIETQR_LOGO_BASE}/${encodeURIComponent(String(code).trim())}.png`;
}

export function sortBanksByPreferred(list) {
  const codeIndex = new Map(PREFERRED_BANK_CODES.map((c, i) => [c, i]));
  return [...list].sort((a, b) => {
    const ai = codeIndex.has(a.code) ? codeIndex.get(a.code) : 999;
    const bi = codeIndex.has(b.code) ? codeIndex.get(b.code) : 999;
    return ai - bi;
  });
}

export function filterPreferredBanks(list) {
  if (!Array.isArray(list)) return [];
  const allowed = new Set(PREFERRED_BANK_CODES);
  return list.filter(
    (b) => b && typeof b.code === "string" && allowed.has(b.code)
  );
}
