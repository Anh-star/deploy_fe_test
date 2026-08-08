// Phase 7B.3-FE — UI/UX enhancement
// Top 30 Vietnamese banks for the payout profile bank selector.
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
  "HDB",
  "VIB",
  "SHB",
  "MSB",
  "OCB",
  "LPB",
  "EIB",
  "BAB",
  "NAB",
  "PGB",
  "KLB",
  "VIETBANK",
  "SEAB",
  "SCB",
  "BVB",
  "ABB",
  "NCB",
  "VAB",
  "PVCB",
  "SHBVN",
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
  {
    code: "HDB",
    shortName: "HDBank",
    name: "Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh",
    logo: `${VIETQR_LOGO_BASE}/HDB.png`,
  },
  {
    code: "VIB",
    shortName: "VIB",
    name: "Ngân hàng TMCP Quốc tế Việt Nam",
    logo: `${VIETQR_LOGO_BASE}/VIB.png`,
  },
  {
    code: "SHB",
    shortName: "SHB",
    name: "Ngân hàng TMCP Sài Gòn - Hà Nội",
    logo: `${VIETQR_LOGO_BASE}/SHB.png`,
  },
  {
    code: "MSB",
    shortName: "MSB",
    name: "Ngân hàng TMCP Hàng Hải Việt Nam",
    logo: `${VIETQR_LOGO_BASE}/MSB.png`,
  },
  {
    code: "OCB",
    shortName: "OCB",
    name: "Ngân hàng TMCP Phương Đông",
    logo: `${VIETQR_LOGO_BASE}/OCB.png`,
  },
  {
    code: "LPB",
    shortName: "LPBank",
    name: "Ngân hàng TMCP Bưu điện Liên Việt",
    logo: `${VIETQR_LOGO_BASE}/LPB.png`,
  },
  {
    code: "EIB",
    shortName: "Eximbank",
    name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam",
    logo: `${VIETQR_LOGO_BASE}/EIB.png`,
  },
  {
    code: "BAB",
    shortName: "Bắc Á Bank",
    name: "Ngân hàng TMCP Bắc Á",
    logo: `${VIETQR_LOGO_BASE}/BAB.png`,
  },
  {
    code: "NAB",
    shortName: "Nam Á Bank",
    name: "Ngân hàng TMCP Nam Á",
    logo: `${VIETQR_LOGO_BASE}/NAB.png`,
  },
  {
    code: "PGB",
    shortName: "PGBank",
    name: "Ngân hàng TMCP Xăng dầu Petrolimex",
    logo: `${VIETQR_LOGO_BASE}/PGB.png`,
  },
  {
    code: "KLB",
    shortName: "KienlongBank",
    name: "Ngân hàng TMCP Kiên Long",
    logo: `${VIETQR_LOGO_BASE}/KLB.png`,
  },
  {
    code: "VIETBANK",
    shortName: "VietBank",
    name: "Ngân hàng TMCP Việt Nam Thương Tín",
    logo: `${VIETQR_LOGO_BASE}/VIETBANK.png`,
  },
  {
    code: "SEAB",
    shortName: "SeABank",
    name: "Ngân hàng TMCP Đông Nam Á",
    logo: `${VIETQR_LOGO_BASE}/SEAB.png`,
  },
  {
    code: "SCB",
    shortName: "SCB",
    name: "Ngân hàng TMCP Sài Gòn",
    logo: `${VIETQR_LOGO_BASE}/SCB.png`,
  },
  {
    code: "BVB",
    shortName: "Bảo Việt Bank",
    name: "Ngân hàng TMCP Bảo Việt",
    logo: `${VIETQR_LOGO_BASE}/BVB.png`,
  },
  {
    code: "ABB",
    shortName: "ABBank",
    name: "Ngân hàng TMCP An Bình",
    logo: `${VIETQR_LOGO_BASE}/ABB.png`,
  },
  {
    code: "NCB",
    shortName: "NCB",
    name: "Ngân hàng TMCP Quốc Dân",
    logo: `${VIETQR_LOGO_BASE}/NCB.png`,
  },
  {
    code: "VAB",
    shortName: "VAB",
    name: "Ngân hàng TMCP Việt Á",
    logo: `${VIETQR_LOGO_BASE}/VAB.png`,
  },
  {
    code: "PVCB",
    shortName: "PVcomBank",
    name: "Ngân hàng TMCP Đại Chúng Việt Nam",
    logo: `${VIETQR_LOGO_BASE}/PVCB.png`,
  },
  {
    code: "SHBVN",
    shortName: "ShinhanBank",
    name: "Ngân hàng TNHH MTV Shinhan Việt Nam",
    logo: `${VIETQR_LOGO_BASE}/SHBVN.png`,
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

/**
 * Phase 7B.3-FE — bank selector no longer drops banks that aren't in
 * PREFERRED_BANK_CODES. The live VietQR API response is the source of
 * truth; we only want to (optionally) sort preferred banks to the top.
 * Pass-through identity keeps every valid bank entry returned by VietQR.
 */
export function filterPreferredBanks(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (b) => b && typeof b.code === "string" && b.code.length > 0
  );
}
