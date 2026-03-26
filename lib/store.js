import * as localStore from "@/lib/local-store";

const CURRENT_USER_KEY = "sisikopi_current_user";

function isSupabaseMode() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

function getBaseHeaders() {
  return {
    "Content-Type": "application/json",
  };
}

function getErrorMessage(payload, fallback) {
  if (payload && typeof payload === "object" && payload.error) {
    return payload.error;
  }

  return fallback;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      ...getBaseHeaders(),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "Permintaan ke server gagal diproses."));
  }

  return payload;
}

function saveCurrentUser(session) {
  if (typeof window === "undefined") {
    return session;
  }

  if (!session) {
    window.localStorage.removeItem(CURRENT_USER_KEY);
    return null;
  }

  window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session));
  return session;
}

export function setCurrentUserSession(session) {
  if (!isSupabaseMode()) {
    return localStore.setCurrentUserSession(session);
  }

  return saveCurrentUser(session);
}

export async function initializeData() {
  if (!isSupabaseMode()) {
    return localStore.initializeData();
  }

  return apiRequest("/api/bootstrap", {
    method: "POST",
  });
}

export async function login(email, password, branchId) {
  if (!isSupabaseMode()) {
    return localStore.login(email, password, branchId);
  }

  const payload = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { email, password, branchId },
  });

  return saveCurrentUser(payload.session || null);
}

export function logout() {
  if (!isSupabaseMode()) {
    return localStore.logout();
  }

  setCurrentUserSession(null);
}

export function getCurrentUser() {
  return localStore.getCurrentUser();
}

export async function getBranches() {
  if (!isSupabaseMode()) {
    return localStore.getBranches();
  }

  const payload = await apiRequest("/api/branches");
  return payload.branches || [];
}

export async function addBranch(branch) {
  if (!isSupabaseMode()) {
    return localStore.addBranch(branch);
  }

  const payload = await apiRequest("/api/branches", {
    method: "POST",
    body: branch,
  });
  return payload.branches || [];
}

export async function updateBranch(id, updates) {
  if (!isSupabaseMode()) {
    return localStore.updateBranch(id, updates);
  }

  const payload = await apiRequest(`/api/branches/${id}`, {
    method: "PATCH",
    body: updates,
  });
  return payload.branches || [];
}

export async function deleteBranch(id) {
  if (!isSupabaseMode()) {
    return localStore.deleteBranch(id);
  }

  const payload = await apiRequest(`/api/branches/${id}`, {
    method: "DELETE",
  });
  return payload.branches || [];
}

export async function getUsers() {
  if (!isSupabaseMode()) {
    return localStore.getUsers();
  }

  const payload = await apiRequest("/api/users");
  return payload.users || [];
}

export async function addUser(user) {
  if (!isSupabaseMode()) {
    return localStore.addUser(user);
  }

  const payload = await apiRequest("/api/users", {
    method: "POST",
    body: user,
  });
  return payload.users || [];
}

export async function updateUser(id, updates) {
  if (!isSupabaseMode()) {
    return localStore.updateUser(id, updates);
  }

  const payload = await apiRequest(`/api/users/${id}`, {
    method: "PATCH",
    body: updates,
  });
  return payload.users || [];
}

export async function deleteUser(id) {
  if (!isSupabaseMode()) {
    return localStore.deleteUser(id);
  }

  const payload = await apiRequest(`/api/users/${id}`, {
    method: "DELETE",
  });
  return payload.users || [];
}

export async function getProducts(branchId) {
  if (!isSupabaseMode()) {
    return localStore.getProducts(branchId);
  }

  const search = new URLSearchParams();
  if (branchId) {
    search.set("branchId", branchId);
  }

  const payload = await apiRequest(`/api/products?${search.toString()}`);
  return payload.products || [];
}

export async function addProduct(product) {
  if (!isSupabaseMode()) {
    return localStore.addProduct(product);
  }

  const payload = await apiRequest("/api/products", {
    method: "POST",
    body: product,
  });
  return payload.products || [];
}

export async function updateProduct(id, updates) {
  if (!isSupabaseMode()) {
    return localStore.updateProduct(id, updates);
  }

  const payload = await apiRequest(`/api/products/${id}`, {
    method: "PATCH",
    body: updates,
  });
  return payload.products || [];
}

export async function deleteProduct(id) {
  if (!isSupabaseMode()) {
    return localStore.deleteProduct(id);
  }

  const payload = await apiRequest(`/api/products/${id}`, {
    method: "DELETE",
  });
  return payload.products || [];
}

export async function getTodayOrders(branchId) {
  if (!isSupabaseMode()) {
    return localStore.getTodayOrders(branchId);
  }

  const search = new URLSearchParams();
  if (branchId) {
    search.set("branchId", branchId);
  }
  search.set("scope", "today");

  const payload = await apiRequest(`/api/orders?${search.toString()}`);
  return payload.orders || [];
}

export async function createOrder(orderData) {
  if (!isSupabaseMode()) {
    return localStore.createOrder(orderData);
  }

  const payload = await apiRequest("/api/orders", {
    method: "POST",
    body: orderData,
  });
  return payload.order;
}

export async function updateOrderStatus(orderId, status) {
  if (!isSupabaseMode()) {
    return localStore.updateOrderStatus(orderId, status);
  }

  const payload = await apiRequest(`/api/orders/${orderId}/status`, {
    method: "PATCH",
    body: { status },
  });
  return payload.orders || [];
}

export async function updateOrderFinancialStatus(orderId, financialStatus, reason = "") {
  if (!isSupabaseMode()) {
    return localStore.updateOrderFinancialStatus(orderId, financialStatus, reason);
  }

  const payload = await apiRequest(`/api/orders/${orderId}/financial-status`, {
    method: "PATCH",
    body: { financialStatus, reason },
  });
  return payload.orders || [];
}

export async function getOrdersByDate(branchId, startDate, endDate) {
  if (!isSupabaseMode()) {
    return localStore.getOrdersByDate(branchId, startDate, endDate);
  }

  const search = new URLSearchParams();
  if (branchId) {
    search.set("branchId", branchId);
  }
  if (startDate) {
    search.set("startDate", startDate);
  }
  if (endDate) {
    search.set("endDate", endDate);
  }

  const payload = await apiRequest(`/api/orders?${search.toString()}`);
  return payload.orders || [];
}

export async function getSummaryByRange(branchId, startDate, endDate = startDate) {
  if (!isSupabaseMode()) {
    return localStore.getSummaryByRange(branchId, startDate, endDate);
  }

  const search = new URLSearchParams();
  if (branchId) {
    search.set("branchId", branchId);
  }
  if (startDate) {
    search.set("startDate", startDate);
  }
  if (endDate) {
    search.set("endDate", endDate);
  }

  const payload = await apiRequest(`/api/reports?${search.toString()}`);
  return payload.summary;
}

export async function getDailySummary(branchId, date) {
  if (!isSupabaseMode()) {
    return localStore.getDailySummary(branchId, date);
  }

  const targetDate = date || new Date().toISOString().split("T")[0];
  return getSummaryByRange(branchId, targetDate, targetDate);
}

export const formatRupiah = localStore.formatRupiah;
export const formatTime = localStore.formatTime;
export const formatDate = localStore.formatDate;
