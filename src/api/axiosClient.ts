import axios, { AxiosError } from 'axios';
import type {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  setRoles,
  setPermissions,
  clearTokens,
} from './tokenStorage';

// Base URL theo openapi.yaml
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

// Tạo instance axios
const axiosClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Biến dùng để tránh gọi refresh song song
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

type RefreshResponseEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
};

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshTokenExpiresIn: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    avatar?: string | null;
    status: string;
    emailVerified: boolean;
    roles: string[];
    permissions: string[];
  };
};

// Request interceptor: gắn Authorization header nếu có accessToken
axiosClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// Hàm gọi refresh token sử dụng axios mặc định (không dùng axiosClient để tránh loop interceptor)
async function performTokenRefresh(): Promise<string | null> {
  const currentRefreshToken = getRefreshToken();

  if (!currentRefreshToken) {
    return null;
  }

  try {
    const response = await axios.post<
      RefreshResponseEnvelope<TokenResponse>
    >(`${BASE_URL}/auth/refresh`, {
      refreshToken: currentRefreshToken,
    });

    const tokenData = response.data.data;
    setAccessToken(tokenData.accessToken);
    setRefreshToken(tokenData.refreshToken);
    setRoles(tokenData.user.roles || []);
    setPermissions(tokenData.user.permissions || []);

    return tokenData.accessToken;
  } catch (error) {
    clearTokens();
    return null;
  }
}

// Response interceptor: xử lý 401, refresh và retry request cũ
axiosClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & {
      _retry?: boolean;
    }) | undefined;

    const status = error.response?.status;

    // Nếu không có request gốc hoặc không phải 401 thì trả lỗi luôn
    if (!originalRequest || status !== 401) {
      return Promise.reject(error);
    }

    // Tránh loop vô hạn: nếu đã retry rồi hoặc đang gọi login/refresh thì không cố thêm
    const requestUrl = originalRequest.url || '';
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') || requestUrl.includes('/auth/refresh');

    if (originalRequest._retry || isAuthEndpoint) {
      clearTokens();
      return Promise.reject(error);
    }

    // Nếu không còn refresh token → không thể refresh
    if (!getRefreshToken()) {
      clearTokens();
      return Promise.reject(error);
    }

    // Dùng Promise chung để tránh nhiều refresh song song
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = (async () => {
        try {
          const newAccessToken = await performTokenRefresh();
          return newAccessToken;
        } finally {
          isRefreshing = false;
        }
      })();
    }

    const newToken = await refreshPromise!;

    if (!newToken) {
      clearTokens();
      return Promise.reject(error);
    }

    // Đánh dấu đã retry để tránh loop
    (originalRequest as any)._retry = true;
    originalRequest.headers = originalRequest.headers || {};
    (originalRequest.headers as Record<string, string>)['Authorization'] =
      `Bearer ${newToken}`;

    // Retry request cũ với accessToken mới
    return axiosClient(originalRequest);
  }
);

export default axiosClient;

