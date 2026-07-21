import axiosClient from "./axiosClient";

/**
 * Unwrap ApiResponse envelope: response.data.data
 */
function unwrap(res) {
  return res.data.data;
}

/**
 * Safe error message extraction.
 */
function toErrorMessage(err) {
  return (
    err?.response?.data?.message ||
    err?.message ||
    "Có lỗi xảy ra. Vui lòng thử lại."
  );
}

/**
 * GET /payment-moderator/withdrawals
 * @param {{ page?: number, size?: number, status?: string, search?: string }} params
 */
export async function listWithdrawals(params = {}) {
  const { page = 0, size = 10, status, search } = params;
  const query = { page, size };
  if (status) query.status = status;
  if (search && search.trim()) query.search = search.trim();
  const res = await axiosClient.get("/payment-moderator/withdrawals", {
    params: query,
  });
  return unwrap(res);
}

/**
 * GET /payment-moderator/withdrawals/{withdrawalId}
 */
export async function getWithdrawal(withdrawalId) {
  const res = await axiosClient.get(
    `/payment-moderator/withdrawals/${withdrawalId}`
  );
  return unwrap(res);
}

/**
 * POST /payment-moderator/withdrawals/{withdrawalId}/approve
 * adminNote is optional — sends {} when blank.
 */
export async function approveWithdrawal(withdrawalId, { adminNote } = {}) {
  const body = adminNote ? { adminNote } : {};
  const res = await axiosClient.post(
    `/payment-moderator/withdrawals/${withdrawalId}/approve`,
    body
  );
  return unwrap(res);
}

/**
 * POST /payment-moderator/withdrawals/{withdrawalId}/reject
 * adminNote is required — caller must trim non-blank.
 */
export async function rejectWithdrawal(withdrawalId, { adminNote }) {
  const res = await axiosClient.post(
    `/payment-moderator/withdrawals/${withdrawalId}/reject`,
    { adminNote }
  );
  return unwrap(res);
}

/**
 * POST /payment-moderator/withdrawals/{withdrawalId}/mark-paid
 * adminNote is required — caller must trim non-blank.
 */
export async function markPaidWithdrawal(withdrawalId, { adminNote }) {
  const res = await axiosClient.post(
    `/payment-moderator/withdrawals/${withdrawalId}/mark-paid`,
    { adminNote }
  );
  return unwrap(res);
}

export { toErrorMessage };
