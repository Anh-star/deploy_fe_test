import axiosClient from "./axiosClient";

function unwrap(res) {
  return res?.data?.data ?? null;
}

export function toContributorWithdrawalErrorMessage(err) {
  const status = err?.response?.status;
  if (status === 400) return "Dữ liệu không hợp lệ";
  if (status === 403) return "Bạn không có quyền truy cập lịch sử rút tiền";
  if (status === 404) return "Không tìm thấy yêu cầu rút tiền";
  if (status === 409) return "Yêu cầu bị xung đột, vui lòng tải lại dữ liệu";
  if (status === 500) return "Có lỗi xảy ra, vui lòng thử lại";
  return (
    err?.response?.data?.message ||
    err?.message ||
    "Có lỗi xảy ra. Vui lòng thử lại."
  );
}

export function toCreateWithdrawalErrorMessage(err) {
  const status = err?.response?.status;
  if (status === 400) {
    return (
      err?.response?.data?.message ||
      "Dữ liệu không hợp lệ"
    );
  }
  if (status === 403) return "Bạn không có quyền tạo yêu cầu rút tiền";
  if (status === 409) return "Yêu cầu bị xung đột, vui lòng tải lại và thử lại";
  if (status === 500) return "Có lỗi xảy ra, vui lòng thử lại";
  return (
    err?.response?.data?.message ||
    err?.message ||
    "Có lỗi xảy ra. Vui lòng thử lại."
  );
}

export function toPayoutProfileErrorMessage(err) {
  const status = err?.response?.status;
  if (status === 400) {
    return (
      err?.response?.data?.message ||
      "Thông tin tài khoản nhận tiền chưa hợp lệ"
    );
  }
  if (status === 403) return "Bạn không có quyền cập nhật tài khoản nhận tiền";
  if (status === 500) return "Có lỗi xảy ra, vui lòng thử lại";
  return (
    err?.response?.data?.message ||
    err?.message ||
    "Có lỗi xảy ra. Vui lòng thử lại."
  );
}

/**
 * GET /api/contributor/withdrawals
 * @param {{ page?: number, size?: number, status?: string }} params
 */
export async function listContributorWithdrawals(params = {}) {
  const { page = 0, size = 10, status } = params;
  const query = { page, size };
  if (status) query.status = status;
  const res = await axiosClient.get("/contributor/withdrawals", {
    params: query,
  });
  return unwrap(res);
}

/**
 * GET /api/contributor/withdrawals/{withdrawalId}
 */
export async function getContributorWithdrawalDetail(withdrawalId) {
  const res = await axiosClient.get(
    `/contributor/withdrawals/${withdrawalId}`
  );
  return unwrap(res);
}

/**
 * GET /api/contributor/balance
 */
export async function getContributorBalance() {
  const res = await axiosClient.get("/contributor/balance");
  return unwrap(res);
}

/**
 * POST /api/contributor/withdrawals
 * @param {{ amount: number|string, clientRequestId: string, sellerNote?: string|null }} payload
 */
export async function createContributorWithdrawal(payload) {
  const res = await axiosClient.post("/contributor/withdrawals", payload);
  return {
    status: res?.status ?? null,
    data: unwrap(res),
  };
}

/**
 * GET /api/contributor/payout-profile
 */
export async function getContributorPayoutProfile() {
  const res = await axiosClient.get("/contributor/payout-profile");
  return unwrap(res);
}

/**
 * PUT /api/contributor/payout-profile
 * @param {{ bankCode: string, bankName: string, bankAccountNumber: string, bankAccountHolderName: string }} payload
 */
export async function upsertContributorPayoutProfile(payload) {
  const res = await axiosClient.put("/contributor/payout-profile", payload);
  return unwrap(res);
}
