import axiosClient from './axiosClient';
import { getApiErrorMessage } from './roleApi';

export { getApiErrorMessage };

function pickData(res) {
  const b = res?.data;
  if (b && typeof b === 'object' && 'data' in b && b.data !== undefined) return b.data;
  return b;
}

export async function getPendingDocuments(pageOrObj = 0, size = 10, status = '', search = '', startDate = '', endDate = '') {
  let page = 0;
  let pSize = 10;
  let st = '';
  let q = '';
  let sDate = '';
  let eDate = '';

  if (typeof pageOrObj === 'object' && pageOrObj !== null) {
    page = pageOrObj.page ?? 0;
    pSize = pageOrObj.size ?? 10;
    st = pageOrObj.status ?? '';
    q = pageOrObj.search ?? '';
    sDate = pageOrObj.startDate ?? '';
    eDate = pageOrObj.endDate ?? '';
  } else {
    page = pageOrObj;
    pSize = size;
    st = status;
    q = search;
    sDate = startDate;
    eDate = endDate;
  }

  const params = { page, size: pSize };
  if (st) params.status = st;
  if (q) params.search = q.trim();
  if (sDate) params.startDate = sDate;
  if (eDate) params.endDate = eDate;

  const res = await axiosClient.get('/admin/documents/pending', {
    params,
  });
  const d = pickData(res) || {};
  return {
    items: Array.isArray(d.content) ? d.content : [],
    page: typeof d.page === 'number' ? d.page : page,
    size: typeof d.size === 'number' ? d.size : pSize,
    total: typeof d.totalElements === 'number' ? d.totalElements : 0,
    totalPages: typeof d.totalPages === 'number' ? d.totalPages : 0,
    pendingCount: Number(d.pendingCount ?? 0),
    approvedCount: Number(d.approvedCount ?? 0),
    rejectedCount: Number(d.rejectedCount ?? 0),
  };
}

/**
 * @param {string} documentId
 * @param {{ status: 'APPROVED' | 'REJECTED', rejectReason?: string }} body
 */
export async function patchDocumentStatus(documentId, body) {
  const res = await axiosClient.patch(
    `/admin/documents/${documentId}/status`,
    body
  );
  return pickData(res);
}

/**
 * @param {string} documentId
 */
export async function getAdminDocumentDetail(documentId) {
  const res = await axiosClient.get(`/admin/documents/${documentId}`);
  return pickData(res);
}

/**
 * Fetches the async Office-to-PDF preview status for a document.
 * Used by the moderator review page to decide when to enable approve.
 *
 * <p>Phase O4B final: this is the dedicated admin metadata endpoint
 * helper. It uses Axios default rejection behavior: 401, 403, 500
 * propagate as errors. The function never reads PDF bytes, never
 * accepts 202 or 409 as a normal status (those belong to the secure
 * preview endpoint), and never touches the binary preview
 * endpoint.</p>
 *
 * @param {string} documentId
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{
 *   officeDocument: boolean,
 *   fullStatus?: 'PENDING'|'PROCESSING'|'READY'|'RETRY'|'DEAD',
 *   lastError?: string,
 *   attemptCount?: number,
 *   maxAttempts?: number,
 *   message?: string|null,
 *   retryable?: boolean
 * }>}
 */
export async function getDocumentPreviewStatus(documentId, options = {}) {
  const config = options.signal ? { signal: options.signal } : {};
  const res = await axiosClient.get(
    `/admin/documents/${documentId}/preview-status`,
    config
  );
  return pickData(res);
}
