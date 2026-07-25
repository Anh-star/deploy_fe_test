import { useState, useEffect } from "react";

export default function ImageGallery({ imageUrls }) {
  const [overlayIdx, setOverlayIdx] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (overlayIdx === null) return;
      if (e.key === "Escape") setOverlayIdx(null);
      if (e.key === "ArrowLeft") {
        setOverlayIdx((prev) => (prev > 0 ? prev - 1 : imageUrls.length - 1));
      }
      if (e.key === "ArrowRight") {
        setOverlayIdx((prev) => (prev < imageUrls.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [overlayIdx, imageUrls]);

  if (!imageUrls || imageUrls.length === 0) return null;

  const count = imageUrls.length;
  const className =
    count === 1
      ? "single"
      : count === 2
      ? "double"
      : count === 3
      ? "triple"
      : "quad";

  return (
    <>
      <div className={`post-image-gallery ${className}`}>
        {imageUrls.slice(0, 4).map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`Post image ${i + 1}`}
            loading="lazy"
            onClick={() => setOverlayIdx(i)}
            style={{ cursor: "pointer" }}
          />
        ))}
      </div>

      {overlayIdx !== null && (
        <div
          className="post-image-overlay"
          onClick={() => setOverlayIdx(null)}
        >
          <button
            type="button"
            className="post-image-overlay-close"
            onClick={() => setOverlayIdx(null)}
            title="Đóng (Esc)"
          >
            &times;
          </button>

          {imageUrls.length > 1 && (
            <>
              <button
                type="button"
                className="post-image-overlay-nav prev"
                onClick={(e) => {
                  e.stopPropagation();
                  setOverlayIdx((prev) => (prev > 0 ? prev - 1 : imageUrls.length - 1));
                }}
                title="Ảnh trước"
              >
                &#8249;
              </button>
              <button
                type="button"
                className="post-image-overlay-nav next"
                onClick={(e) => {
                  e.stopPropagation();
                  setOverlayIdx((prev) => (prev < imageUrls.length - 1 ? prev + 1 : 0));
                }}
                title="Ảnh tiếp theo"
              >
                &#8250;
              </button>
            </>
          )}

          <div className="post-image-overlay-content" onClick={(e) => e.stopPropagation()}>
            <img
              src={imageUrls[overlayIdx]}
              alt={`Zoomed image ${overlayIdx + 1}`}
            />
            {imageUrls.length > 1 && (
              <div className="post-image-overlay-counter">
                {overlayIdx + 1} / {imageUrls.length}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
