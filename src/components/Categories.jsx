import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sidebarService } from "../services/api";

const ICON_MAP = {
  docker: "/imgs/Docker.png",
  java: "/imgs/Java.png",
  unity: "/imgs/Unity.png",
  mysql: "/imgs/MySQL.png",
  "sql-server": "/imgs/SQLServer.png",
  sqlserver: "/imgs/SQLServer.png",
  firebase: "/imgs/Firebase.png",
  python: "/imgs/Python.png",
  javascript: "/imgs/Javascript.png",
  react: "/imgs/React.png",
};

const DEFAULT_CATEGORIES = [
  { name: "Docker", icon: "/imgs/Docker.png", slug: "docker" },
  { name: "Java", icon: "/imgs/Java.png", slug: "java" },
  { name: "Unity", icon: "/imgs/Unity.png", slug: "unity" },
  { name: "MySQL", icon: "/imgs/MySQL.png", slug: "mysql" },
  { name: "SQL Server", icon: "/imgs/SQLServer.png", slug: "sql-server" },
  { name: "Firebase", icon: "/imgs/Firebase.png", slug: "firebase" },
];

function getCategoryIcon(name, slug) {
  const key1 = (slug || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const key2 = (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [k, v] of Object.entries(ICON_MAP)) {
    const cleanK = k.replace(/[^a-z0-9]/g, "");
    if (key1.includes(cleanK) || key2.includes(cleanK)) return v;
  }
  return null;
}

export default function Categories() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  useEffect(() => {
    let cancelled = false;
    sidebarService
      .getCategories()
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.slice(0, 6).map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            icon: getCategoryIcon(c.name, c.slug) || "/imgs/Docker.png",
          }));
          setCategories(mapped);
        }
      })
      .catch((err) => {
        console.error("Lỗi khi tải danh mục trang chủ:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCategoryClick = (cat) => {
    if (cat.id) {
      navigate(`/documents?categoryId=${encodeURIComponent(cat.id)}`);
    } else {
      navigate(`/documents?keyword=${encodeURIComponent(cat.name)}`);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: "1215px", background: "#F5F7F8", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ width: "100%", height: "47px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ color: "#0F172A", fontSize: "24px", fontWeight: 700, lineHeight: "32px" }}>Danh mục tài liệu</div>
      </div>

      <div style={{ width: "100%", display: "flex", gap: "16px", justifyContent: "flex-start", alignItems: "flex-start", flexWrap: "wrap" }}>
        {categories.map((cat, idx) => (
          <div key={cat.id || cat.slug || idx} style={{ flex: "1 1 calc(16.666% - 14px)", minWidth: "150px", maxWidth: "195px", display: "flex", flexDirection: "column" }}>
            <div
              onClick={() => handleCategoryClick(cat)}
              style={{
                height: "194px",
                padding: "36px 12px",
                background: "white",
                borderRadius: "16px",
                outline: "1px solid rgba(0,0,0,0)",
                outlineOffset: "-1px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "14px",
                cursor: "pointer",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
              className="document-card--interactive"
            >
              <img
                src={cat.icon || "/imgs/Docker.png"}
                alt={cat.name}
                style={{ width: "42px", height: "42px", objectFit: "contain" }}
                onError={(e) => {
                  e.currentTarget.src = "/imgs/Docker.png";
                }}
              />
              <div
                title={cat.name}
                style={{
                  color: "#0F172A",
                  fontSize: "14px",
                  fontWeight: 600,
                  lineHeight: "20px",
                  width: "100%",
                  maxWidth: "160px",
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  padding: "0 4px",
                }}
              >
                {cat.name}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}