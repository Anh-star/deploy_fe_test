import axiosClient from "../api/axiosClient";
import type { UserInfo } from "../api/authApi";
import { hasRole } from "./permissionUtils";

export type ContributorRegistrationSnapshot = {
  status: string | null;
  submissionCount: number;
};

export const ContributorUploadGateVariant = {
  PENDING: "PENDING",
  REJECTED_RESUBMIT: "REJECTED_RESUBMIT",
  REJECTED_EXHAUSTED: "REJECTED_EXHAUSTED",
  APPROVED_AWAITING_ROLE: "APPROVED_AWAITING_ROLE",
  INSUFFICIENT_ROLE: "INSUFFICIENT_ROLE",
} as const;

export type ContributorUploadGateVariant =
  (typeof ContributorUploadGateVariant)[keyof typeof ContributorUploadGateVariant];

export type ContributorUploadAccessResult =
  | { kind: "ALLOW_UPLOAD" }
  | { kind: "NAVIGATE_CONTRIBUTOR_REGISTRATION" }
  | { kind: "GATE_MODAL"; variant: ContributorUploadGateVariant };

/**
 * Snapshot đăng ký contributor. `status === null`: chưa từng gửi request (backend trả data null).
 */
export async function fetchContributorRegistrationSnapshot(): Promise<
  ContributorRegistrationSnapshot | undefined
> {
  try {
    const response = await axiosClient.get("/contributor/registration-status");
    const data = response.data?.data;
    if (data == null) {
      return { status: null, submissionCount: 0 };
    }
    return {
      status: data.status != null ? String(data.status).toUpperCase() : null,
      submissionCount: Number(data.submissionCount ?? 0),
    };
  } catch {
    return undefined;
  }
}

/**
 * Quyền đăng tải / hướng đăng ký contributor: CONTRIBUTOR → upload;
 * USER có request chưa approved → modal; chưa gửi request → trang đăng ký.
 */
export async function checkContributorAccess(
  user: UserInfo
): Promise<ContributorUploadAccessResult> {
  if (hasRole(user, "CONTRIBUTOR")) {
    return { kind: "ALLOW_UPLOAD" };
  }

  if (!hasRole(user, "USER")) {
    return {
      kind: "GATE_MODAL",
      variant: ContributorUploadGateVariant.INSUFFICIENT_ROLE,
    };
  }

  const snap = await fetchContributorRegistrationSnapshot();
  if (snap === undefined) {
    return { kind: "NAVIGATE_CONTRIBUTOR_REGISTRATION" };
  }

  const { status, submissionCount } = snap;

  if (status == null) {
    return { kind: "NAVIGATE_CONTRIBUTOR_REGISTRATION" };
  }

  switch (status) {
    case "PENDING":
    case "NEED_INFO":
      return {
        kind: "GATE_MODAL",
        variant: ContributorUploadGateVariant.PENDING,
      };
    case "REJECTED":
      if (submissionCount >= 2) {
        return {
          kind: "GATE_MODAL",
          variant: ContributorUploadGateVariant.REJECTED_EXHAUSTED,
        };
      }
      return {
        kind: "GATE_MODAL",
        variant: ContributorUploadGateVariant.REJECTED_RESUBMIT,
      };
    case "APPROVED":
      return {
        kind: "GATE_MODAL",
        variant: ContributorUploadGateVariant.APPROVED_AWAITING_ROLE,
      };
    default:
      return { kind: "NAVIGATE_CONTRIBUTOR_REGISTRATION" };
  }
}

/** Alias — cùng logic với {@link checkContributorAccess}. */
export const checkContributorUploadAccess = checkContributorAccess;

export type ContributorUploadGateModalConfig = {
  title: string;
  message: string;
  primary?: { label: string; path: string };
  closeOnly?: boolean;
};

export function getContributorUploadGateModalCopy(
  variant: ContributorUploadGateVariant
): ContributorUploadGateModalConfig {
  switch (variant) {
    case ContributorUploadGateVariant.PENDING:
      return {
        title: "Yêu cầu đang được xử lý",
        message:
          "Yêu cầu của bạn đang được chờ duyệt, vui lòng đợi thêm để có thể đăng tải tài liệu.",
        primary: { label: "Xem trạng thái", path: "/contributor-status" },
      };
    case ContributorUploadGateVariant.REJECTED_RESUBMIT:
      return {
        title: "Yêu cầu bị từ chối",
        message:
          "Yêu cầu của bạn đã bị từ chối. Bạn có thể gửi lại yêu cầu này 1 lần nữa.",
        primary: { label: "Gửi lại yêu cầu", path: "/contributor-request" },
      };
    case ContributorUploadGateVariant.REJECTED_EXHAUSTED:
      return {
        title: "Không thể đăng ký",
        message:
          "Bạn đã hết lượt để đăng ký trở thành Contributor. Nếu cần hỗ trợ, vui lòng liên hệ email: studyit.support@gmail.com",
        closeOnly: true,
      };
    case ContributorUploadGateVariant.APPROVED_AWAITING_ROLE:
      return {
        title: "Đang cập nhật vai trò",
        message:
          "Hồ sơ của bạn đã được phê duyệt. Vai trò Contributor có thể cần vài phút để đồng bộ trên tài khoản của bạn.",
        primary: { label: "Xem trạng thái", path: "/contributor-status" },
      };
    case ContributorUploadGateVariant.INSUFFICIENT_ROLE:
      return {
        title: "Không thể đăng tải",
        message:
          "Tài khoản của bạn không có quyền đăng tải tài liệu trên kênh này.",
        closeOnly: true,
      };
    default:
      return {
        title: "Thông báo",
        message: "Không thể truy cập trang đăng tải.",
        closeOnly: true,
      };
  }
}
