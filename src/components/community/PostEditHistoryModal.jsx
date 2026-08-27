import React, { useEffect, useState } from "react";
import { getPostEditHistory } from "../../api/communityApi";
import { formatDateTime } from "../../utils/dateUtils";
import { HistoryIcon, EditIcon, StarIcon, DocumentIcon, DownloadIcon } from "../icons";
import "../../styles/community.css";

export default function PostEditHistoryModal({ postId, currentPost, onClose }) {
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    setError(null);
    getPostEditHistory(postId)
      .then((data) => {
        setHistoryList(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Failed to load post edit history:", err);
        setError("Không thể tải lịch sử chỉnh sửa bài viết.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [postId]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 12000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          maxHeight: "85vh",
          background: "#FFFFFF",
          borderRadius: "18px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            borderBottom: "1px solid #E2E8F0",
            padding: "16px 20px",
            background: "#F8FAFC",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
              <HistoryIcon size={18} color="#4F46E5" /> Lịch sử chỉnh sửa bài viết
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
              Xem nội dung, hình ảnh và tài liệu trước và sau các lần chỉnh sửa
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ fontSize: "22px", background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "4px 8px", borderRadius: "8px" }}
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748B" }}>
              <div className="cmp-spinner" style={{ margin: "0 auto 12px" }}></div>
              <p>Đang tải lịch sử chỉnh sửa...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#EF4444" }}>
              <p>{error}</p>
            </div>
          ) : historyList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748B" }}>
              <p>Bài viết này chưa có bản lưu lịch sử chỉnh sửa nào trước đó.</p>
            </div>
          ) : (
            <div className="post-history-timeline" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Current Version */}
              {currentPost && (
                <div
                  style={{
                    border: "1px solid #3B82F6",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    background: "rgba(59, 130, 246, 0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontWeight: "600", color: "#2563EB", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <StarIcon size={14} color="#2563EB" /> Phiên bản hiện tại (Mới nhất)
                    </span>
                    <span style={{ fontSize: "12px", color: "#64748B" }}>
                      {currentPost.updatedAt ? formatDateTime(currentPost.updatedAt) : "Hiện tại"}
                    </span>
                  </div>
                  {currentPost.title && (
                    <h4 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "600", color: "#1F2937" }}>
                      {currentPost.title}
                    </h4>
                  )}
                  {currentPost.content && (
                    /<[a-z][\s\S]*>/i.test(currentPost.content) ? (
                      <div
                        style={{ fontSize: "14px", lineHeight: "1.6", color: "#374151" }}
                        dangerouslySetInnerHTML={{ __html: currentPost.content }}
                      />
                    ) : (
                      <div
                        style={{
                          fontSize: "14px",
                          lineHeight: "1.6",
                          color: "#374151",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {currentPost.content}
                      </div>
                    )
                  )}

                  {/* Current Version Images */}
                  {currentPost.imageUrls && currentPost.imageUrls.length > 0 && (
                    <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: currentPost.imageUrls.length === 1 ? "1fr" : "repeat(auto-fill, minmax(120px, 1fr))", gap: "8px" }}>
                      {currentPost.imageUrls.map((imgUrl, i) => (
                        <a key={i} href={imgUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", borderRadius: "8px", overflow: "hidden", border: "1px solid #E2E8F0" }}>
                          <img
                            src={imgUrl}
                            alt={`Current Attached ${i + 1}`}
                            style={{ width: "100%", height: currentPost.imageUrls.length === 1 ? "auto" : "100px", maxHeight: "200px", objectFit: "cover", display: "block" }}
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Current Version Documents/Files */}
                  {currentPost.fileUrls && currentPost.fileUrls.length > 0 && (
                    <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {currentPost.fileUrls.map((fileUrl, i) => {
                        const filename = fileUrl.split("/").pop().replace(/^\d+_/, "") || `Tài liệu ${i + 1}`;
                        return (
                          <a
                            key={i}
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "7px 12px",
                              background: "#FFFFFF",
                              border: "1px solid #BFDBFE",
                              borderRadius: "6px",
                              textDecoration: "none",
                              fontSize: "12.5px",
                              color: "#1E293B",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                              <DocumentIcon size={15} color="#2563EB" />
                              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "340px", fontWeight: "500" }}>
                                {filename}
                              </span>
                            </div>
                            <span style={{ fontSize: "12px", color: "#2563EB", display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                              Tải xuống <DownloadIcon size={13} color="currentColor" />
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  )}

                  {/* Current Version Poll */}
                  {currentPost.poll && (
                    <div style={{ marginTop: "10px", padding: "10px 12px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "8px" }}>
                      <div style={{ fontWeight: "600", fontSize: "13px", color: "#1D4ED8", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                        📊 Cuộc bình chọn: {currentPost.poll.question || "Bình chọn ý kiến"}
                      </div>
                      {currentPost.poll.options && currentPost.poll.options.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {currentPost.poll.options.map((opt, oIdx) => (
                            <div key={oIdx} style={{ padding: "5px 10px", background: "#FFFFFF", border: "1px solid #DBEAFE", borderRadius: "6px", fontSize: "12.5px", color: "#1E40AF" }}>
                              • {typeof opt === "string" ? opt : opt.optionText}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Historical Versions */}
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#475569", marginTop: "8px" }}>
                Các phiên bản trước đó ({historyList.length} lần sửa):
              </div>

              {historyList.map((item, idx) => (
                <div
                  key={item.id || idx}
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    background: "#FFFFFF",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          background: "#F1F5F9",
                          color: "#475569",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "600",
                        }}
                      >
                        Bản #{historyList.length - idx}
                      </span>
                      <span style={{ fontSize: "13px", color: "#1E293B", fontWeight: "500" }}>
                        {item.editorName || "Tác giả"}
                      </span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#64748B" }}>
                      {item.editedAt ? formatDateTime(item.editedAt) : ""}
                    </span>
                  </div>
                  {item.title && (
                    <h4 style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: "600", color: "#1E293B" }}>
                      {item.title}
                    </h4>
                  )}
                  {item.content && (
                    /<[a-z][\s\S]*>/i.test(item.content) ? (
                      <div
                        style={{
                          fontSize: "13px",
                          lineHeight: "1.6",
                          color: "#334155",
                          background: "#F8FAFC",
                          padding: "10px 12px",
                          borderRadius: "6px",
                          border: "1px solid #F1F5F9",
                        }}
                        dangerouslySetInnerHTML={{ __html: item.content }}
                      />
                    ) : (
                      <div
                        style={{
                          fontSize: "13px",
                          lineHeight: "1.6",
                          color: "#334155",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          background: "#F8FAFC",
                          padding: "10px 12px",
                          borderRadius: "6px",
                          border: "1px solid #F1F5F9",
                        }}
                      >
                        {item.content}
                      </div>
                    )
                  )}

                  {/* Historical Version Images */}
                  {item.imageUrls && item.imageUrls.length > 0 && (
                    <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: item.imageUrls.length === 1 ? "1fr" : "repeat(auto-fill, minmax(110px, 1fr))", gap: "8px" }}>
                      {item.imageUrls.map((imgUrl, i) => (
                        <a key={i} href={imgUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", borderRadius: "6px", overflow: "hidden", border: "1px solid #E2E8F0" }}>
                          <img
                            src={imgUrl}
                            alt={`Historical Attached ${i + 1}`}
                            style={{ width: "100%", height: item.imageUrls.length === 1 ? "auto" : "90px", maxHeight: "180px", objectFit: "cover", display: "block" }}
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Historical Version Documents/Files */}
                  {item.fileUrls && item.fileUrls.length > 0 && (
                    <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {item.fileUrls.map((fileUrl, i) => {
                        const filename = fileUrl.split("/").pop().replace(/^\d+_/, "") || `Tài liệu ${i + 1}`;
                        return (
                          <a
                            key={i}
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "6px 10px",
                              background: "#F8FAFC",
                              border: "1px solid #E2E8F0",
                              borderRadius: "6px",
                              textDecoration: "none",
                              fontSize: "12px",
                              color: "#334155",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                              <DocumentIcon size={14} color="#64748B" />
                              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "320px" }}>
                                {filename}
                              </span>
                            </div>
                            <span style={{ fontSize: "11.5px", color: "#2563EB", display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                              Tải xuống <DownloadIcon size={12} color="currentColor" />
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  )}

                  {/* Historical Version Poll */}
                  {(item.pollQuestion || (item.pollOptions && item.pollOptions.length > 0)) && (
                    <div style={{ marginTop: "10px", padding: "10px 12px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px" }}>
                      <div style={{ fontWeight: "600", fontSize: "13px", color: "#1E293B", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                        📊 Cuộc bình chọn: {item.pollQuestion || "Bình chọn ý kiến"}
                      </div>
                      {item.pollOptions && item.pollOptions.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {item.pollOptions.map((opt, oIdx) => (
                            <div key={oIdx} style={{ padding: "4px 8px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "4px", fontSize: "12px", color: "#475569" }}>
                              • {opt}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ borderTop: "1px solid #E2E8F0", padding: "12px 20px", display: "flex", justifyContent: "flex-end", background: "#F8FAFC" }}>
          <button
            type="button"
            className="cmp-btn cmp-btn-dismiss"
            onClick={onClose}
            style={{ padding: "8px 18px" }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
