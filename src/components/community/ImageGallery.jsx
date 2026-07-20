import { useState } from "react";

export default function ImageGallery({ imageUrls }) {
  const [overlayIdx, setOverlayIdx] = useState(null);

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
          <img
            src={imageUrls[overlayIdx]}
            alt="Zoomed"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
