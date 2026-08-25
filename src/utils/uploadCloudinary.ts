const CLOUD_NAME = "doac10qib";
const UPLOAD_PRESET = "upload_file_demo";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;

export const uploadToCloudinary = async (file: File, folder?: string) => {
  const isDocument =
    file.type === "application/pdf" ||
    file.type === "application/msword" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".pdf") ||
    file.name.toLowerCase().endsWith(".doc") ||
    file.name.toLowerCase().endsWith(".docx") ||
    file.name.toLowerCase().endsWith(".pptx");
  const maxSize = isDocument ? 25 * 1024 * 1024 : 10 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error(`File size exceeds ${isDocument ? "25MB" : "10MB"} limit.`);
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];

  if (!allowedTypes.includes(file.type) && !isDocument) {
    throw new Error(
      "Invalid file type. Only JPG, PNG, WEBP, PDF, DOC, DOCX, and PPTX are allowed."
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("resource_type", "auto");

  if (folder) {
    formData.append("folder", folder);
  }

  try {
    const response = await fetch(CLOUDINARY_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Upload failed");
    }

    const data = await response.json();
    let secureUrl = data.secure_url;

    if (isDocument) {
      secureUrl = secureUrl.replace("/image/upload/", "/raw/upload/");
    }

    return {
      url: secureUrl,
      certificateName: file.name,
      publicId: data.public_id,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
};
