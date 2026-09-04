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
          const featuredSlugs = ["docker", "java", "unity", "mysql", "sql-server", "firebase"];
          const featured = [];
          const remaining = [];

          data.forEach((c) => {
            const cleanSlug = (c.slug || c.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            const isFeatured = featuredSlugs.some((s) => s.replace(/[^a-z0-9]/g, "") === cleanSlug);
            if (isFeatured) {
              featured.push(c);
            } else {
              remaining.push(c);
            }
          });

          // Sort featured according to featuredSlugs order
          featured.sort((a, b) => {
            const cleanA = (a.slug || a.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            const cleanB = (b.slug || b.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            const idxA = featuredSlugs.findIndex((s) => s.replace(/[^a-z0-9]/g, "") === cleanA);
            const idxB = featuredSlugs.findIndex((s) => s.replace(/[^a-z0-9]/g, "") === cleanB);
            return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
          });

          const combined = [...featured, ...remaining].slice(0, 6);
          const mapped = combined.map((c) => ({
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
    <div className="home-categories-wrap">
      <div className="home-section-header">
        <div className="home-section-title">Danh mục tài liệu</div>
      </div>

      <div className="home-categories-grid">
        {categories.map((cat, idx) => (
          <div
            key={cat.id || cat.slug || idx}
            onClick={() => handleCategoryClick(cat)}
            className="home-category-card document-card--interactive"
          >
            <img
              src={cat.icon || "/imgs/Docker.png"}
              alt={cat.name}
              className="home-category-card__icon"
              onError={(e) => {
                e.currentTarget.src = "/imgs/Docker.png";
              }}
            />
            <div
              title={cat.name}
              className="home-category-card__name"
            >
              {cat.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}