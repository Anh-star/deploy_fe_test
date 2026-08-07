import React from "react";
import StudyItPdfViewer from "./StudyItPdfViewer";

/**
 * LimitedPaidPdfViewer — compatibility wrapper around the shared
 * {@link StudyItPdfViewer}.
 *
 * <p>The previous implementation kept its own white-toolbar viewer
 * for the LIMITED mode; the new shared viewer re-uses the same
 * PDF.js rendering pipeline AND the same dark native-style toolbar
 * for both FULL and LIMITED so the UI does not jump before and
 * after purchase.</p>
 *
 * <p>Behaviour preserved:</p>
 * <ul>
 *   <li>Pages 1..N where N = {@code visiblePages} render with the
 *       original readable content.</li>
 *   <li>Pages after N render the backend-rasterised/blurred
 *       derivative.</li>
 *   <li>The first locked page (page N+1) shows the large StudyIT
 *       HTML unlock card.</li>
 *   <li>Subsequent locked pages show a compact badge.</li>
 *   <li>Download / print are disabled in LIMITED mode.</li>
 *   <li>The viewer renders the full page list as a continuous
 *       scrollable document; pages are never mounted/unmounted
 *       lazily.</li>
 * </ul>
 *
 * <p>The wrapper exists ONLY for callers that still import
 * {@code LimitedPaidPdfViewer} directly. New code MUST import
 * {@code StudyItPdfViewer} instead so the FULL and LIMITED
 * previews stay visually identical.</p>
 */
export default function LimitedPaidPdfViewer(props) {
  return (
    <StudyItPdfViewer
      {...props}
      mode="LIMITED"
    />
  );
}