import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { ImageIcon, DocumentIcon, PencilIcon } from "../icons";
import CreatePostModal from "./CreatePostModal";

export default function CreatePostBox({ onPostCreated }) {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || "U")}&background=E2E8F0&color=475569&size=88`;

  return (
    <>
      <div className="create-post-box" onClick={() => setIsModalOpen(true)}>
        <div className="create-post-header">
          <img
            className="create-post-avatar"
            src={user?.avatar || defaultAvatar}
            alt=""
          />
          <div className="create-post-fake-input">
            {user?.fullName || "Bạn"} ơi, bạn đang nghĩ gì?
          </div>
        </div>

        <div className="create-post-actions">
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <button className="create-post-action-chip" type="button">
              <ImageIcon size={17} color="#64748B" />
              <span>Hình ảnh</span>
            </button>
            <button className="create-post-action-chip" type="button">
              <DocumentIcon size={17} color="#64748B" />
              <span>Tài liệu</span>
            </button>
          </div>

          <button className="create-post-submit" type="button" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <PencilIcon size={16} color="#FFFFFF" />
            <span>Đăng bài</span>
          </button>
        </div>
      </div>

      <CreatePostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPostCreated={onPostCreated}
      />
    </>
  );
}
