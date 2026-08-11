import React from "react";

// Regex matching URLs starting with http://, https://, or www.
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

export default function AutoLinkText({ text, className = "" }) {
  if (!text || typeof text !== "string") {
    return null;
  }

  const parts = text.split(URL_REGEX);

  return (
    <span className={`auto-link-text ${className}`}>
      {parts.map((part, index) => {
        if (part.match(URL_REGEX)) {
          let href = part;
          if (part.toLowerCase().startsWith("www.")) {
            href = `https://${part}`;
          }
          // Trim trailing punctuation like period or comma if accidentally matched
          const cleanHref = href.replace(/[.,;!?]+$/, "");
          const cleanLabel = part.replace(/[.,;!?]+$/, "");
          const trailingPunctuation = part.slice(cleanLabel.length);

          return (
            <React.Fragment key={index}>
              <a
                href={cleanHref}
                target="_blank"
                rel="noopener noreferrer"
                className="clickable-post-link"
                onClick={(e) => e.stopPropagation()}
              >
                {cleanLabel}
                <svg
                  className="external-link-icon"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ display: "inline", marginLeft: "3px", verticalAlign: "baseline" }}
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
              {trailingPunctuation}
            </React.Fragment>
          );
        }
        return part;
      })}
    </span>
  );
}
