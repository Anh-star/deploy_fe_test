import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
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
          <div style={{ display: "flex", gap: "12px" }}>
            <button className="create-post-action-chip" type="button">
              💬 Thảo luận
            </button>
            <button className="create-post-action-chip" type="button">
              📊 Khảo sát
            </button>
          </div>

          <button className="create-post-submit" type="button">
            Tạo bài viết
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
