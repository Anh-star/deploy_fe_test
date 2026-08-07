/**
 * TypeScript models for the async Office-to-PDF preview artifact status.
 * These mirror the backend DTOs exactly.
 */

/**
 * The worker-managed status of the FULL preview artifact.
 * Mirrors {@code com.cmcu.itstudy.dto.document.DocumentPreviewArtifactStatusDto}.
 */
export type DocumentPreviewArtifactStatus =
  | "PENDING"
  | "PROCESSING"
  | "READY"
  | "RETRY"
  | "DEAD";

/**
 * Snapshot of the async preview status for a single document.
 * Mirrors {@code com.cmcu.itstudy.dto.document.DocumentPreviewStatusDto}.
 */
export type DocumentPreviewStatus = {
  /**
   * Whether this document is an Office file (DOC/DOCX) managed by the
   * async preview worker.
   */
  officeDocument: boolean;

  /**
   * The worker-managed FULL artifact status. `undefined` when
   * `officeDocument` is `false`.
   */
  fullStatus?: DocumentPreviewArtifactStatus;

  /**
   * Bounded human-readable error from the last failed attempt.
   * `undefined` when the artifact is not in a failed state.
   * Never contains stack traces, paths, or credentials.
   */
  lastError?: string;

  /**
   * Number of conversion attempts so far.
   * `undefined` when `officeDocument` is `false`.
   */
  attemptCount?: number;

  /**
   * Maximum attempts before the artifact becomes DEAD.
   * `undefined` when `officeDocument` is `false`.
   */
  maxAttempts?: number;
};

/**
 * Whether a moderator can approve an Office document.
 * The decision is derived entirely from the backend response.
 */
export type ModeratorApprovalStatus =
  | "CAN_APPROVE"      // FULL artifact is READY
  | "CANNOT_APPROVE"   // FULL artifact is PENDING / PROCESSING / RETRY / DEAD
  | "NOT_OFFICE";       // Document is not an Office file — no restriction
