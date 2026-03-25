"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import logoImage from "@/logo.png";
import {
  addUser,
  addProduct,
  createOrder,
  deleteUser,
  deleteProduct,
  formatDate,
  formatRupiah,
  formatTime,
  getBranches,
  getCurrentUser,
  getDailySummary,
  getOrdersByDate,
  getProducts,
  getSummaryByRange,
  getTodayOrders,
  getUsers,
  initializeData,
  login,
  logout,
  setCurrentUserSession,
  updateUser,
  updateOrderStatus,
  updateProduct,
} from "@/lib/store";

const DEFAULT_LOGIN_FORM = {
  email: "",
  password: "",
  branchId: "branch-1",
};

const DEFAULT_PRODUCT_CATEGORY = "kopi";
const DEFAULT_USER_ROLE = "kasir";
const ORDER_STATUSES = ["pending", "processing", "done"];
const ORDER_STATUS_META = {
  pending: {
    label: "Pending",
    badgeClass: "badge-warning",
    description: "Menunggu diproses",
  },
  processing: {
    label: "Diproses",
    badgeClass: "badge-info",
    description: "Sedang dikerjakan",
  },
  done: {
    label: "Selesai",
    badgeClass: "badge-success",
    description: "Siap diserahkan",
  },
};

function createEmptySummary() {
  return {
    totalRevenue: 0,
    totalTransactions: 0,
    avgTicket: 0,
    totalOrders: 0,
    topMenu: [],
    paymentBreakdown: { cash: 0, qris: 0 },
    statusBreakdown: { pending: 0, processing: 0, done: 0 },
    orders: [],
    startDate: "",
    endDate: "",
  };
}

function createEmptyChoice() {
  return {
    name: "",
    extra: "0",
  };
}

function createEmptyOptionGroup() {
  return {
    group: "",
    label: "",
    choices: [createEmptyChoice()],
  };
}

function createEmptyUserDraft(defaultBranchId = "branch-1") {
  return {
    name: "",
    email: "",
    role: DEFAULT_USER_ROLE,
    branchId: defaultBranchId,
    password: "",
  };
}

function createUserDraft(user) {
  return {
    name: user.name || "",
    email: user.email || "",
    role: user.role || DEFAULT_USER_ROLE,
    branchId: user.branchId || "branch-1",
    password: "",
  };
}

function createEmptyProductDraft(defaultBranchId = "all") {
  return {
    name: "",
    category: DEFAULT_PRODUCT_CATEGORY,
    basePrice: "",
    emoji: "\u2615",
    branchId: defaultBranchId || "all",
    isAvailable: true,
    options: [],
  };
}

function createProductDraft(product) {
  return {
    name: product.name || "",
    category: product.category || DEFAULT_PRODUCT_CATEGORY,
    basePrice: String(Number(product.basePrice) || 0),
    emoji: product.emoji || "\u2615",
    branchId: product.branchId || "all",
    isAvailable: product.isAvailable ?? true,
    options: (product.options || []).map((group) => ({
      group: group.group || "",
      label: group.label || "",
      choices: (group.choices || []).map((choice) => ({
        name: choice.name || "",
        extra: String(Number(choice.extra) || 0),
      })),
    })),
  };
}

function slugifyGroupKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeProductDraft(draft, defaultBranchId) {
  const name = draft.name.trim();
  const category = draft.category.trim().toLowerCase();
  const emoji = draft.emoji.trim();
  const basePrice = Number(draft.basePrice);

  if (!name) {
    throw new Error("Nama menu wajib diisi.");
  }

  if (!category) {
    throw new Error("Kategori menu wajib diisi.");
  }

  if (!/^[a-z0-9- ]+$/.test(category)) {
    throw new Error("Kategori hanya boleh berisi huruf, angka, spasi, atau tanda minus.");
  }

  if (!Number.isFinite(basePrice) || basePrice < 0 || !Number.isInteger(basePrice)) {
    throw new Error("Harga dasar harus berupa angka bulat 0 atau lebih.");
  }

  if (name.length > 60) {
    throw new Error("Nama menu maksimal 60 karakter.");
  }

  const options = [];
  const usedGroupKeys = new Set();
  (draft.options || []).forEach((group, index) => {
    const groupKeyInput = group.group.trim();
    const groupLabel = group.label.trim();
    const validChoices = (group.choices || [])
      .map((choice) => ({
        name: choice.name.trim(),
        extra: Number(choice.extra),
      }))
      .filter((choice) => choice.name);
    const hasAnyValue =
      groupKeyInput ||
      groupLabel ||
      validChoices.length > 0 ||
      (group.choices || []).some(
        (choice) =>
          choice.name.trim() ||
          (String(choice.extra ?? "").trim() && Number(choice.extra) > 0),
      );

    if (!hasAnyValue) {
      return;
    }

    if (!groupLabel) {
      throw new Error(`Label grup custom #${index + 1} wajib diisi.`);
    }

    if (!validChoices.length) {
      throw new Error(`Minimal satu pilihan valid dibutuhkan pada grup ${groupLabel}.`);
    }

    const choiceNames = new Set();
    validChoices.forEach((choice) => {
      const normalizedChoiceName = choice.name.toLowerCase();
      if (choiceNames.has(normalizedChoiceName)) {
        throw new Error(`Pilihan di grup ${groupLabel} tidak boleh duplikat.`);
      }

      choiceNames.add(normalizedChoiceName);
    });

    const invalidChoice = validChoices.find(
      (choice) =>
        !Number.isFinite(choice.extra) || choice.extra < 0 || !Number.isInteger(choice.extra),
    );
    if (invalidChoice) {
      throw new Error(`Harga tambahan di grup ${groupLabel} harus angka bulat 0 atau lebih.`);
    }

    const normalizedGroupKey =
      slugifyGroupKey(groupKeyInput || groupLabel || `opsi-${index + 1}`) || `opsi-${index + 1}`;
    if (usedGroupKeys.has(normalizedGroupKey)) {
      throw new Error(`Key grup ${groupLabel} tidak boleh duplikat.`);
    }

    usedGroupKeys.add(normalizedGroupKey);
    options.push({
      group: normalizedGroupKey,
      label: groupLabel,
      choices: validChoices,
    });
  });

  return {
    name,
    category,
    basePrice,
    emoji: emoji || "\u2615",
    branchId: draft.branchId || defaultBranchId || "all",
    isAvailable: Boolean(draft.isAvailable),
    options,
  };
}

function getProductScopeLabel(product, branches) {
  if (product.branchId === "all") {
    return "Semua cabang";
  }

  return branches.find((branch) => branch.id === product.branchId)?.name || "Cabang khusus";
}

function getUserRoleLabel(role) {
  return role === "admin" ? "Admin" : "Barista";
}

function normalizeUserDraft(draft, defaultBranchId) {
  const name = String(draft.name || "").trim();
  const email = String(draft.email || "").trim().toLowerCase();
  const role = draft.role === "admin" ? "admin" : "kasir";
  const branchId = String(draft.branchId || defaultBranchId || "").trim();
  const password = String(draft.password || "");

  if (!name) {
    throw new Error("Nama akun wajib diisi.");
  }

  if (!email) {
    throw new Error("Username wajib diisi.");
  }

  if (!/^[a-z0-9._-]+$/.test(email)) {
    throw new Error("Username hanya boleh huruf kecil, angka, titik, underscore, atau minus.");
  }

  if (!branchId) {
    throw new Error("Cabang akun wajib dipilih.");
  }

  return {
    name,
    email,
    role,
    branchId,
    password,
  };
}

function getOrderStatusMeta(status) {
  return ORDER_STATUS_META[status] || ORDER_STATUS_META.pending;
}

function getTodayDateValue() {
  return new Date().toISOString().split("T")[0];
}

function normalizeDateRange(startDate, endDate) {
  if (!startDate && !endDate) {
    const today = getTodayDateValue();
    return { startDate: today, endDate: today };
  }

  if (!startDate) {
    return { startDate: endDate, endDate };
  }

  if (!endDate) {
    return { startDate, endDate: startDate };
  }

  return startDate <= endDate
    ? { startDate, endDate }
    : { startDate: endDate, endDate: startDate };
}

function getReportPeriodLabel(startDate, endDate) {
  if (!startDate || !endDate) {
    return "Pilih tanggal untuk melihat laporan.";
  }

  if (startDate === endDate) {
    return formatDate(startDate);
  }

  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function getOrderStatusCount(orders, status) {
  return orders.filter((order) => order.status === status).length;
}

function sortOrdersByWorkflow(orders) {
  const statusRank = {
    pending: 0,
    processing: 1,
    done: 2,
  };

  return [...orders].sort((left, right) => {
    const leftRank = statusRank[left.status] ?? 99;
    const rightRank = statusRank[right.status] ?? 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return new Date(right.createdAt) - new Date(left.createdAt);
  });
}

function getRecentOrders(orders, limit = 5) {
  return [...orders]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .slice(0, limit);
}

function getOrderItemsSummary(order) {
  return order.items
    .map((item) =>
      item.selectedOptionsText
        ? `${item.quantity}x ${item.productName} (${item.selectedOptionsText})`
        : `${item.quantity}x ${item.productName}`,
    )
    .join(", ");
}

function getOrderStatusActionLabel(currentStatus, nextStatus) {
  if (nextStatus === "pending") {
    return "Set Pending";
  }

  if (nextStatus === "processing") {
    return currentStatus === "done" ? "Buka Lagi" : "Proses";
  }

  return "Selesai";
}

function getOrderStatusActionClass(nextStatus) {
  return nextStatus === "done" ? "btn btn-success btn-sm" : "btn btn-secondary btn-sm";
}

function getNextOrderStatuses(currentStatus) {
  if (currentStatus === "pending") {
    return ["processing", "done"];
  }

  if (currentStatus === "processing") {
    return ["pending", "done"];
  }

  return ["processing"];
}

function getCategoryOptions(products) {
  return ["all", ...new Set(products.map((product) => product.category))];
}

function getCartQuantity(cart) {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function getCartTotal(cart) {
  return cart.reduce((sum, item) => sum + item.subtotal, 0);
}

function getOptionsExtra(selectedOptions) {
  return selectedOptions.reduce(
    (sum, option) => sum + (Number(option.extra) || 0),
    0,
  );
}

function getSelectedOptionsSummary(selectedOptions) {
  return selectedOptions.map((option) => `${option.label}: ${option.name}`).join(", ");
}

function buildDefaultSelections(product) {
  return (product.options || []).map((group) => {
    const choice = group.choices[0];
    return {
      group: group.group,
      label: group.label || group.group,
      name: choice.name,
      extra: Number(choice.extra) || 0,
    };
  });
}

function buildCartItemId(productId, selectedOptions) {
  return [
    productId,
    ...selectedOptions.map((option) => `${option.group}:${option.name}`),
  ].join("|");
}

function buildCartItem(product, selectedOptions) {
  const optionsExtra = getOptionsExtra(selectedOptions);
  const unitPrice = (Number(product.basePrice) || 0) + optionsExtra;

  return {
    id: buildCartItemId(product.id, selectedOptions),
    productId: product.id,
    productName: product.name,
    quantity: 1,
    unitPrice,
    subtotal: unitPrice,
    selectedOptions,
    selectedOptionsText: getSelectedOptionsSummary(selectedOptions),
  };
}

function escapeReceiptHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildReceiptHtml(order, branchName) {
  const itemsHtml = order.items
    .map((item) => {
      const optionsHtml = item.selectedOptionsText
        ? `<div style="font-size:10px;color:#666;margin-top:2px;">${escapeReceiptHtml(
            item.selectedOptionsText,
          )}</div>`
        : "";

      return `
        <div style="margin:6px 0 8px;">
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <span>${escapeReceiptHtml(`${item.quantity}x ${item.productName}`)}</span>
            <span>${escapeReceiptHtml(formatRupiah(item.subtotal))}</span>
          </div>
          ${optionsHtml}
        </div>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>Struk ${escapeReceiptHtml(order.orderNumber)}</title>
    <style>
      body {
        font-family: "Courier New", monospace;
        background: #ffffff;
        color: #111111;
        margin: 0;
        padding: 12px;
      }
      .receipt {
        width: 58mm;
        margin: 0 auto;
        font-size: 11px;
        line-height: 1.45;
      }
      .center { text-align: center; }
      .divider {
        border-top: 1px dashed #111111;
        margin: 8px 0;
      }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .total {
        font-weight: 700;
        font-size: 12px;
      }
      .muted {
        color: #555555;
      }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="center">
        <strong>Sisikopi</strong><br />
        <span>${escapeReceiptHtml(branchName)}</span>
      </div>
      <div class="divider"></div>
      <div>No. Order: ${escapeReceiptHtml(order.orderNumber)}</div>
      <div>Kasir: ${escapeReceiptHtml(order.cashierName)}</div>
      <div>Jam: ${escapeReceiptHtml(formatTime(order.createdAt))}</div>
      <div>Pembayaran: ${escapeReceiptHtml(order.paymentMethod.toUpperCase())}</div>
      <div class="divider"></div>
      ${itemsHtml}
      <div class="divider"></div>
      <div class="row total">
        <span>Total</span>
        <span>${escapeReceiptHtml(formatRupiah(order.totalAmount))}</span>
      </div>
      <div class="divider"></div>
      <div class="center muted">Terima kasih sudah mampir ke Sisikopi.</div>
    </div>
    <script>
      window.onload = () => {
        window.print();
      };
    </script>
  </body>
</html>`;
}

function StatusBanner({ error, notice }) {
  if (!error && !notice) {
    return null;
  }

  return (
    <div className={`status-banner ${error ? "is-error" : "is-success"}`}>
      {error || notice}
    </div>
  );
}

function ToastViewport({ toasts, onDismiss }) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.type}`} key={toast.id}>
          <div className="toast-body">
            <strong>{toast.title}</strong>
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            className="toast-close"
            aria-label="Tutup notifikasi"
            onClick={() => onDismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function BrandMark({ compact = false, inverted = false }) {
  return (
    <div
      className={`brand-mark ${compact ? "is-compact" : ""} ${
        inverted ? "is-inverted" : ""
      }`}
    >
      <div className="brand-mark-frame">
        <Image
          src={logoImage}
          alt="Logo Sisikopi"
          width={compact ? 150 : 210}
          height={compact ? 64 : 90}
          priority
          className="brand-mark-image"
        />
      </div>
    </div>
  );
}

function CustomizationModal({
  product,
  selectedOptions,
  onSelectChoice,
  onClose,
  onConfirm,
}) {
  if (!product) {
    return null;
  }

  const optionsExtra = getOptionsExtra(selectedOptions);
  const totalPrice = (Number(product.basePrice) || 0) + optionsExtra;

  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2>Custom Menu</h2>
            <p className="modal-subtitle">
              {product.name} • {formatRupiah(totalPrice)}
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Tutup
          </button>
        </div>

        <div className="customize-options">
          {(product.options || []).map((group) => {
            const selected = selectedOptions.find(
              (option) => option.group === group.group,
            );

            return (
              <div className="option-group" key={group.group}>
                <h3>{group.label || group.group}</h3>
                <div className="option-choices">
                  {group.choices.map((choice) => {
                    const isSelected = selected?.name === choice.name;
                    const extra = Number(choice.extra) || 0;

                    return (
                      <button
                        key={`${group.group}-${choice.name}`}
                        className={`option-choice ${isSelected ? "selected" : ""}`}
                        onClick={() => onSelectChoice(group, choice)}
                      >
                        <span>{choice.name}</span>
                        {extra > 0 ? (
                          <span className="option-extra-price">
                            +{formatRupiah(extra)}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            Tambahkan ke Keranjang
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({
  branches,
  loginForm,
  isSubmitting,
  error,
  notice,
  onFieldChange,
  onSubmit,
}) {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <BrandMark />
          <p>Masuk ke POS untuk mulai transaksi dan monitoring cabang</p>
        </div>

        <StatusBanner error={error} notice={notice} />

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="branchId">Cabang</label>
            <select
              id="branchId"
              className="input"
              value={loginForm.branchId}
              onChange={(event) => onFieldChange("branchId", event.target.value)}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="email">Username</label>
            <input
              id="email"
              className="input"
              required
              value={loginForm.email}
              onChange={(event) => onFieldChange("email", event.target.value)}
              placeholder="admin atau barista"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              required
              minLength={6}
              value={loginForm.password}
              onChange={(event) => onFieldChange("password", event.target.value)}
              placeholder="Masukkan password"
            />
          </div>

          <button className="btn btn-primary login-btn" disabled={isSubmitting}>
            {isSubmitting ? "Memproses..." : "Masuk ke Dashboard"}
          </button>
        </form>

        <div className="login-help">
          <strong>Akses login</strong>
          <p>Gunakan akun operasional yang sudah disiapkan untuk cabang terkait.</p>
        </div>
      </div>
    </div>
  );
}

function OrderStatusBadge({ status }) {
  const meta = getOrderStatusMeta(status);

  return <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>;
}

function OrderWorkflowActions({ order, isSubmitting, onStatusChange }) {
  const nextStatuses = getNextOrderStatuses(order.status);

  return (
    <div className="workflow-actions">
      {nextStatuses.map((nextStatus) => (
        <button
          key={`${order.id}-${nextStatus}`}
          type="button"
          className={getOrderStatusActionClass(nextStatus)}
          disabled={isSubmitting}
          onClick={() => onStatusChange(order, nextStatus)}
        >
          {getOrderStatusActionLabel(order.status, nextStatus)}
        </button>
      ))}
    </div>
  );
}

function AdminScreen({
  currentUser,
  branchName,
  currentBranchId,
  branches,
  users,
  products,
  summary,
  todayOrders,
  isSubmitting,
  onLogout,
  onSaveUser,
  onDeleteUser,
  onSaveProduct,
  onDeleteProduct,
  onOrderStatusChange,
  onPrintReceipt,
  onToggleProductAvailability,
  error,
  notice,
}) {
  const avgTicket =
    summary.totalTransactions > 0
      ? summary.totalRevenue / summary.totalTransactions
      : 0;
  const todayDate = getTodayDateValue();
  const [editingProductId, setEditingProductId] = useState("");
  const [productDraft, setProductDraft] = useState(() =>
    createEmptyProductDraft(currentBranchId),
  );
  const [formError, setFormError] = useState("");
  const [editingUserId, setEditingUserId] = useState("");
  const [userDraft, setUserDraft] = useState(() =>
    createEmptyUserDraft(currentBranchId),
  );
  const [userFormError, setUserFormError] = useState("");
  const [reportMode, setReportMode] = useState("single");
  const [reportDate, setReportDate] = useState(todayDate);
  const [reportRange, setReportRange] = useState({
    startDate: todayDate,
    endDate: todayDate,
  });
  const [reportSummary, setReportSummary] = useState(() => createEmptySummary());
  const [reportOrders, setReportOrders] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFetchError, setReportFetchError] = useState("");
  const workflowCounts = ORDER_STATUSES.map((status) => ({
    status,
    count: getOrderStatusCount(todayOrders, status),
    meta: getOrderStatusMeta(status),
  }));
  const latestOrders = getRecentOrders(todayOrders);
  const normalizedReportRange =
    reportMode === "single"
      ? normalizeDateRange(reportDate, reportDate)
      : normalizeDateRange(reportRange.startDate, reportRange.endDate);
  const reportTitle = getReportPeriodLabel(
    normalizedReportRange.startDate,
    normalizedReportRange.endDate,
  );
  const reportValidationMessage =
    reportMode === "single"
      ? !reportDate
        ? "Pilih tanggal laporan terlebih dahulu."
        : ""
      : !reportRange.startDate || !reportRange.endDate
        ? "Lengkapi tanggal awal dan akhir laporan."
        : "";

  useEffect(() => {
    let ignore = false;

    async function loadReport() {
      if (reportValidationMessage) {
        setReportSummary(createEmptySummary());
        setReportOrders([]);
        setReportFetchError("");
        return;
      }

      setReportLoading(true);
      setReportFetchError("");

      try {
        const [nextSummary, nextOrders] = await Promise.all([
          getSummaryByRange(
            currentBranchId,
            normalizedReportRange.startDate,
            normalizedReportRange.endDate,
          ),
          getOrdersByDate(
            currentBranchId,
            normalizedReportRange.startDate,
            normalizedReportRange.endDate,
          ),
        ]);

        if (ignore) {
          return;
        }

        setReportSummary(nextSummary || createEmptySummary());
        setReportOrders(
          [...(nextOrders || [])].sort(
            (left, right) => new Date(right.createdAt) - new Date(left.createdAt),
          ),
        );
      } catch (loadError) {
        if (ignore) {
          return;
        }

        setReportSummary(createEmptySummary());
        setReportOrders([]);
        setReportFetchError(loadError.message || "Laporan gagal dimuat.");
      } finally {
        if (!ignore) {
          setReportLoading(false);
        }
      }
    }

    loadReport();

    return () => {
      ignore = true;
    };
  }, [
    currentBranchId,
    normalizedReportRange.endDate,
    normalizedReportRange.startDate,
    reportValidationMessage,
  ]);

  function resetProductForm() {
    setEditingProductId("");
    setProductDraft(createEmptyProductDraft(currentBranchId));
    setFormError("");
  }

  function resetUserForm() {
    setEditingUserId("");
    setUserDraft(createEmptyUserDraft(currentBranchId));
    setUserFormError("");
  }

  function handleReportModeChange(nextMode) {
    setReportMode(nextMode);
    if (nextMode === "single") {
      setReportDate(normalizedReportRange.startDate);
      return;
    }

    setReportRange(normalizedReportRange);
  }

  function handleReportRangeChange(field, value) {
    setReportRange((currentRange) => ({
      ...currentRange,
      [field]: value,
    }));
  }

  function validateProductAgainstCatalog(productData) {
    const normalizedName = productData.name.trim().toLowerCase();
    const hasDuplicateName = products.some((product) => {
      if (product.id === editingProductId) {
        return false;
      }

      const overlapsScope =
        product.branchId === "all" ||
        productData.branchId === "all" ||
        product.branchId === productData.branchId;
      return overlapsScope && product.name.trim().toLowerCase() === normalizedName;
    });

    if (hasDuplicateName) {
      throw new Error("Nama menu sudah dipakai pada scope cabang yang sama.");
    }
  }

  function validateUserAgainstCatalog(userData) {
    const normalizedEmail = userData.email.trim().toLowerCase();
    const duplicateUser = users.find((user) => {
      if (user.id === editingUserId) {
        return false;
      }

      return user.email.trim().toLowerCase() === normalizedEmail;
    });

    if (duplicateUser) {
      throw new Error("Username sudah dipakai akun lain.");
    }

    if (!editingUserId && userData.password.length < 8) {
      throw new Error("Password akun minimal 8 karakter.");
    }

    if (editingUserId && userData.password && userData.password.length < 8) {
      throw new Error("Password baru minimal 8 karakter.");
    }
  }

  function handleDraftChange(field, value) {
    setProductDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  function handleUserDraftChange(field, value) {
    setUserDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  function handleOptionGroupChange(groupIndex, field, value) {
    setProductDraft((currentDraft) => ({
      ...currentDraft,
      options: currentDraft.options.map((group, index) =>
        index === groupIndex ? { ...group, [field]: value } : group,
      ),
    }));
  }

  function handleOptionChoiceChange(groupIndex, choiceIndex, field, value) {
    setProductDraft((currentDraft) => ({
      ...currentDraft,
      options: currentDraft.options.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              choices: group.choices.map((choice, currentChoiceIndex) =>
                currentChoiceIndex === choiceIndex
                  ? { ...choice, [field]: value }
                  : choice,
              ),
            }
          : group,
      ),
    }));
  }

  function handleAddOptionGroup() {
    setProductDraft((currentDraft) => ({
      ...currentDraft,
      options: [...currentDraft.options, createEmptyOptionGroup()],
    }));
  }

  function handleRemoveOptionGroup(groupIndex) {
    setProductDraft((currentDraft) => ({
      ...currentDraft,
      options: currentDraft.options.filter((_, index) => index !== groupIndex),
    }));
  }

  function handleAddChoice(groupIndex) {
    setProductDraft((currentDraft) => ({
      ...currentDraft,
      options: currentDraft.options.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              choices: [...group.choices, createEmptyChoice()],
            }
          : group,
      ),
    }));
  }

  function handleRemoveChoice(groupIndex, choiceIndex) {
    setProductDraft((currentDraft) => ({
      ...currentDraft,
      options: currentDraft.options.map((group, index) => {
        if (index !== groupIndex) {
          return group;
        }

        if (group.choices.length <= 1) {
          return {
            ...group,
            choices: [createEmptyChoice()],
          };
        }

        return {
          ...group,
          choices: group.choices.filter((_, currentChoiceIndex) => currentChoiceIndex !== choiceIndex),
        };
      }),
    }));
  }

  function handleEditProduct(product) {
    setEditingProductId(product.id);
    setProductDraft(createProductDraft(product));
    setFormError("");
  }

  function handleEditUser(user) {
    setEditingUserId(user.id);
    setUserDraft(createUserDraft(user));
    setUserFormError("");
  }

  async function handleSubmitProduct(event) {
    event.preventDefault();
    setFormError("");

    try {
      const nextProduct = normalizeProductDraft(productDraft, currentBranchId);
      validateProductAgainstCatalog(nextProduct);
      await onSaveProduct(nextProduct, editingProductId || null);
      resetProductForm();
    } catch (submitError) {
      setFormError(submitError.message || "Menu gagal disimpan.");
    }
  }

  async function handleDeleteProduct(product) {
    const confirmed = window.confirm(
      `Hapus menu ${product.name}? Tindakan ini tidak bisa dibatalkan.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      await onDeleteProduct(product.id);
      if (editingProductId === product.id) {
        resetProductForm();
      }
    } catch (deleteError) {
      setFormError(deleteError.message || "Menu gagal dihapus.");
    }
  }

  async function handleSubmitUser(event) {
    event.preventDefault();
    setUserFormError("");

    try {
      const nextUser = normalizeUserDraft(userDraft, currentBranchId);
      validateUserAgainstCatalog(nextUser);
      await onSaveUser(nextUser, editingUserId || null);
      resetUserForm();
    } catch (submitError) {
      setUserFormError(submitError.message || "Akun gagal disimpan.");
    }
  }

  async function handleDeleteUser(user) {
    if (user.id === currentUser.id) {
      setUserFormError("Akun yang sedang aktif tidak bisa dihapus.");
      return;
    }

    const confirmed = window.confirm(
      `Hapus akun ${user.name} (${user.email})? Tindakan ini tidak bisa dibatalkan.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      await onDeleteUser(user.id);
      if (editingUserId === user.id) {
        resetUserForm();
      }
    } catch (deleteError) {
      setUserFormError(deleteError.message || "Akun gagal dihapus.");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <BrandMark compact inverted />
          <div>
            <h1>Dashboard Admin</h1>
          <p>
            Pantau penjualan harian, menu aktif, dan transaksi cabang{" "}
            <span className="text-accent">{branchName}</span>.
          </p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="badge badge-accent">{branchName}</span>
          <button className="btn btn-secondary" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <StatusBanner error={error} notice={notice} />

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-card-icon">Rp</div>
          <div className="stat-card-value">{formatRupiah(summary.totalRevenue)}</div>
          <div className="stat-card-label">Omzet Hari Ini</div>
        </article>
        <article className="stat-card">
          <div className="stat-card-icon">TRX</div>
          <div className="stat-card-value">{summary.totalTransactions}</div>
          <div className="stat-card-label">Transaksi Selesai</div>
        </article>
        <article className="stat-card">
          <div className="stat-card-icon">AVG</div>
          <div className="stat-card-value">{formatRupiah(avgTicket)}</div>
          <div className="stat-card-label">Rata-rata Ticket</div>
        </article>
        <article className="stat-card">
          <div className="stat-card-icon">MENU</div>
          <div className="stat-card-value">
            {products.filter((product) => product.isAvailable).length}
          </div>
          <div className="stat-card-label">Menu Aktif</div>
        </article>
      </section>

      <section className="page-grid">
        <div className="section-stack">
          <article className="card">
            <div className="card-heading">
              <h2>{editingUserId ? "Edit Akun" : "Tambah Akun Baru"}</h2>
              <p>Kelola akun admin dan barista untuk tiap cabang langsung dari dashboard.</p>
            </div>

            {userFormError ? (
              <div className="status-banner is-error">{userFormError}</div>
            ) : null}

            <form className="product-form" onSubmit={handleSubmitUser}>
              <div className="product-form-grid">
                <div className="form-group">
                  <label htmlFor="user-name">Nama Lengkap</label>
                  <input
                    id="user-name"
                    className="input"
                    required
                    value={userDraft.name}
                    onChange={(event) => handleUserDraftChange("name", event.target.value)}
                    placeholder="Misal: Owner Sutomo"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="user-email">Username</label>
                  <input
                    id="user-email"
                    className="input"
                    required
                    value={userDraft.email}
                    onChange={(event) => handleUserDraftChange("email", event.target.value)}
                    placeholder="owner.sutomo"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="user-role">Role</label>
                  <select
                    id="user-role"
                    className="input"
                    value={userDraft.role}
                    onChange={(event) => handleUserDraftChange("role", event.target.value)}
                  >
                    <option value="admin">Admin</option>
                    <option value="kasir">Barista</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="user-branch">Cabang</label>
                  <select
                    id="user-branch"
                    className="input"
                    value={userDraft.branchId}
                    onChange={(event) => handleUserDraftChange("branchId", event.target.value)}
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group product-form-full">
                  <label htmlFor="user-password">
                    {editingUserId ? "Password Baru" : "Password"}
                  </label>
                  <input
                    id="user-password"
                    type="password"
                    className="input"
                    value={userDraft.password}
                    onChange={(event) => handleUserDraftChange("password", event.target.value)}
                    placeholder={
                      editingUserId
                        ? "Kosongkan jika tidak ingin mengganti password"
                        : "Minimal 8 karakter"
                    }
                  />
                </div>
              </div>

              <div className="product-form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetUserForm}
                >
                  {editingUserId ? "Batal Edit" : "Reset Form"}
                </button>
                <button className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting
                    ? "Menyimpan..."
                    : editingUserId
                      ? "Simpan Akun"
                      : "Tambah Akun"}
                </button>
              </div>
            </form>

            <div className="table-wrap">
              <table className="menu-table account-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Cabang</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="menu-row-title">
                          <div>
                            <div>{user.name}</div>
                            <div className="helper-text">
                              {user.id === currentUser.id ? "Akun aktif" : "Akun operasional"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`badge ${user.role === "admin" ? "badge-accent" : "badge-info"}`}>
                          {getUserRoleLabel(user.role)}
                        </span>
                      </td>
                      <td>{getProductScopeLabel({ branchId: user.branchId }, branches)}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEditUser(user)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            disabled={user.id === currentUser.id}
                            onClick={() => handleDeleteUser(user)}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card">
            <div className="card-heading">
              <h2>{editingProductId ? "Edit Menu" : "Tambah Menu Baru"}</h2>
              <p>
                Kelola katalog cabang tanpa menyentuh kode. Menu aktif otomatis
                muncul di layar kasir.
              </p>
            </div>

            {(formError || notice) && !error ? (
              <div className={`status-banner ${formError ? "is-error" : "is-success"}`}>
                {formError || notice}
              </div>
            ) : null}

            <form className="product-form" onSubmit={handleSubmitProduct}>
              <div className="product-form-grid">
                <div className="form-group">
                  <label htmlFor="product-name">Nama Menu</label>
                  <input
                    id="product-name"
                    className="input"
                    required
                    maxLength={60}
                    value={productDraft.name}
                    onChange={(event) => handleDraftChange("name", event.target.value)}
                    placeholder="Misal: Es Kopi Gula Aren"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="product-category">Kategori</label>
                  <input
                    id="product-category"
                    className="input"
                    required
                    value={productDraft.category}
                    onChange={(event) => handleDraftChange("category", event.target.value)}
                    placeholder="kopi, non-kopi, snack"
                    list="product-category-suggestions"
                  />
                  <datalist id="product-category-suggestions">
                    <option value="kopi" />
                    <option value="non-kopi" />
                    <option value="snack" />
                  </datalist>
                </div>

                <div className="form-group">
                  <label htmlFor="product-price">Harga Dasar</label>
                  <input
                    id="product-price"
                    type="number"
                    min="0"
                    step="1"
                    className="input"
                    required
                    value={productDraft.basePrice}
                    onChange={(event) => handleDraftChange("basePrice", event.target.value)}
                    placeholder="18000"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="product-emoji">Emoji / Ikon</label>
                  <input
                    id="product-emoji"
                    className="input"
                    value={productDraft.emoji}
                    onChange={(event) => handleDraftChange("emoji", event.target.value)}
                    placeholder="☕"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="product-branch">Scope Menu</label>
                  <select
                    id="product-branch"
                    className="input"
                    value={productDraft.branchId}
                    onChange={(event) => handleDraftChange("branchId", event.target.value)}
                  >
                    <option value="all">Semua cabang</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="product-status">Status Jual</label>
                  <select
                    id="product-status"
                    className="input"
                    value={productDraft.isAvailable ? "active" : "inactive"}
                    onChange={(event) =>
                      handleDraftChange("isAvailable", event.target.value === "active")
                    }
                  >
                    <option value="active">Aktif dijual</option>
                    <option value="inactive">Sembunyikan dari kasir</option>
                  </select>
                </div>
              </div>

              <div className="option-editor">
                <div className="option-editor-header">
                  <div>
                    <h3>Opsi Custom Menu</h3>
                    <p className="helper-text">
                      Tambahkan grup seperti Size, Sugar, Ice, atau Topping beserta
                      harga tambahannya.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddOptionGroup}
                  >
                    Tambah Grup
                  </button>
                </div>

                {productDraft.options.length ? (
                  <div className="option-group-list">
                    {productDraft.options.map((group, groupIndex) => (
                      <div className="option-group-card" key={`group-${groupIndex}`}>
                        <div className="option-group-card-header">
                          <strong>Grup #{groupIndex + 1}</strong>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleRemoveOptionGroup(groupIndex)}
                          >
                            Hapus Grup
                          </button>
                        </div>

                        <div className="product-form-grid product-form-grid-tight">
                          <div className="form-group">
                            <label>Key Grup</label>
                            <input
                              className="input"
                              value={group.group}
                              onChange={(event) =>
                                handleOptionGroupChange(groupIndex, "group", event.target.value)
                              }
                              placeholder="size"
                            />
                          </div>

                          <div className="form-group">
                            <label>Label Tampilan</label>
                            <input
                              className="input"
                              value={group.label}
                              onChange={(event) =>
                                handleOptionGroupChange(groupIndex, "label", event.target.value)
                              }
                              placeholder="Size"
                            />
                          </div>
                        </div>

                        <div className="option-choice-list">
                          {group.choices.map((choice, choiceIndex) => (
                            <div
                              className="option-choice-row"
                              key={`group-${groupIndex}-choice-${choiceIndex}`}
                            >
                              <input
                                className="input"
                                value={choice.name}
                                onChange={(event) =>
                                  handleOptionChoiceChange(
                                    groupIndex,
                                    choiceIndex,
                                    "name",
                                    event.target.value,
                                  )
                                }
                                placeholder="Less Ice"
                              />
                              <input
                                type="number"
                                min="0"
                                className="input option-choice-price"
                                value={choice.extra}
                                onChange={(event) =>
                                  handleOptionChoiceChange(
                                    groupIndex,
                                    choiceIndex,
                                    "extra",
                                    event.target.value,
                                  )
                                }
                                placeholder="0"
                              />
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleRemoveChoice(groupIndex, choiceIndex)}
                              >
                                Hapus
                              </button>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleAddChoice(groupIndex)}
                        >
                          Tambah Pilihan
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="option-editor-empty">
                    <p className="empty-state">
                      Belum ada opsi custom. Biarkan kosong jika menu tidak perlu
                      custom.
                    </p>
                  </div>
                )}
              </div>

              <div className="product-form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetProductForm}
                >
                  {editingProductId ? "Batal Edit" : "Reset Form"}
                </button>
                <button className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting
                    ? "Menyimpan..."
                    : editingProductId
                      ? "Simpan Perubahan"
                      : "Tambah Menu"}
                </button>
              </div>
            </form>
          </article>

          <article className="card">
            <div className="card-heading">
              <h2>Order Terbaru</h2>
              <p>Pantau status pesanan dan dorong workflow dari dashboard admin.</p>
            </div>
            {latestOrders.length ? (
              latestOrders.map((order) => (
                <div className="list-item" key={order.id}>
                  <div>
                    <div className="list-item-title">
                      #{order.orderNumber} • {order.cashierName}
                    </div>
                    <div className="helper-text">
                      {order.items.length} item • {formatTime(order.createdAt)}
                    </div>
                    <div className="helper-text order-snippet">{getOrderItemsSummary(order)}</div>
                    <div className="list-item-meta">
                      <OrderStatusBadge status={order.status} />
                      <span className="badge badge-accent">
                        {order.paymentMethod.toUpperCase()}
                      </span>
                    </div>
                    <OrderWorkflowActions
                      order={order}
                      isSubmitting={isSubmitting}
                      onStatusChange={onOrderStatusChange}
                    />
                  </div>
                  <div className="list-item-side">
                    <div className="list-item-value">{formatRupiah(order.totalAmount)}</div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onPrintReceipt(order)}
                    >
                      Print
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">Belum ada transaksi untuk cabang ini hari ini.</p>
            )}
          </article>

          <article className="card">
            <div className="card-heading">
              <h2>Menu Aktif</h2>
              <p>Katalog yang saat ini bisa dijual atau disembunyikan dari kasir.</p>
            </div>
            <div className="table-wrap">
              <table className="menu-table">
                <thead>
                  <tr>
                    <th>Menu</th>
                    <th>Kategori</th>
                    <th>Harga</th>
                    <th>Custom</th>
                    <th>Scope</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="menu-row-title">
                          <span className="menu-row-emoji">{product.emoji}</span>
                          <div>
                            <div>{product.name}</div>
                            <div className="helper-text">ID {product.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>{product.category}</td>
                      <td>{formatRupiah(product.basePrice)}</td>
                      <td>
                        {(product.options || []).length ? (
                          <div className="menu-option-summary">
                            <strong>{product.options.length} grup</strong>
                            <span className="helper-text">
                              {product.options.map((group) => group.label).join(", ")}
                            </span>
                          </div>
                        ) : (
                          "Tidak ada"
                        )}
                      </td>
                      <td>{getProductScopeLabel(product, branches)}</td>
                      <td>
                        <span
                          className={`badge ${
                            product.isAvailable ? "badge-success" : "badge-warning"
                          }`}
                        >
                          {product.isAvailable ? "Aktif" : "Disembunyikan"}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEditProduct(product)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onToggleProductAvailability(product)}
                          >
                            {product.isAvailable ? "Hide" : "Show"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteProduct(product)}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <div className="section-stack">
          <article className="card">
            <div className="card-heading">
              <h2>Laporan Periode</h2>
              <p>Filter tanggal tunggal atau rentang tanggal untuk melihat histori transaksi.</p>
            </div>

            <div className="report-filters">
              <div className="report-mode-switch">
                <button
                  type="button"
                  className={`btn btn-sm ${
                    reportMode === "single" ? "btn-primary" : "btn-secondary"
                  }`}
                  onClick={() => handleReportModeChange("single")}
                >
                  Tanggal
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${
                    reportMode === "range" ? "btn-primary" : "btn-secondary"
                  }`}
                  onClick={() => handleReportModeChange("range")}
                >
                  Range
                </button>
              </div>

              {reportMode === "single" ? (
                <div className="report-filter-grid">
                  <div className="form-group">
                    <label htmlFor="report-date">Tanggal Laporan</label>
                    <input
                      id="report-date"
                      type="date"
                      className="input"
                      required
                      value={reportDate}
                      onChange={(event) => setReportDate(event.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="report-filter-grid">
                  <div className="form-group">
                    <label htmlFor="report-start-date">Dari Tanggal</label>
                    <input
                      id="report-start-date"
                      type="date"
                      className="input"
                      required
                      value={reportRange.startDate}
                      onChange={(event) =>
                        handleReportRangeChange("startDate", event.target.value)
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="report-end-date">Sampai Tanggal</label>
                    <input
                      id="report-end-date"
                      type="date"
                      className="input"
                      required
                      value={reportRange.endDate}
                      onChange={(event) =>
                        handleReportRangeChange("endDate", event.target.value)
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {reportValidationMessage ? (
              <p className="report-validation">{reportValidationMessage}</p>
            ) : null}
            {reportFetchError ? (
              <div className="status-banner is-error">{reportFetchError}</div>
            ) : null}

            <div className="report-period-label">
              <strong>{reportTitle}</strong>
              <span className="helper-text">
                {reportLoading ? "Memuat laporan..." : `${reportOrders.length} transaksi tercatat`}
              </span>
            </div>

            <div className="report-summary-grid">
              <div className="report-summary-card">
                <span className="helper-text">Omzet Selesai</span>
                <strong>{formatRupiah(reportSummary.totalRevenue)}</strong>
              </div>
              <div className="report-summary-card">
                <span className="helper-text">Transaksi Selesai</span>
                <strong>{reportSummary.totalTransactions}</strong>
              </div>
              <div className="report-summary-card">
                <span className="helper-text">Rata-rata Ticket</span>
                <strong>{formatRupiah(reportSummary.avgTicket)}</strong>
              </div>
              <div className="report-summary-card">
                <span className="helper-text">Total Order</span>
                <strong>{reportSummary.totalOrders}</strong>
              </div>
            </div>

            <div className="report-breakdown-grid">
              <div className="report-breakdown-card">
                <h3>Status Order</h3>
                <div className="summary-list">
                  {ORDER_STATUSES.map((status) => (
                    <div className="summary-row" key={status}>
                      <OrderStatusBadge status={status} />
                      <strong>{reportSummary.statusBreakdown[status] || 0}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="report-breakdown-card">
                <h3>Pembayaran Selesai</h3>
                <div className="summary-list">
                  <div className="summary-row">
                    <span>Cash</span>
                    <strong>{formatRupiah(reportSummary.paymentBreakdown.cash)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>QRIS</span>
                    <strong>{formatRupiah(reportSummary.paymentBreakdown.qris)}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-heading report-subheading">
              <h3>Transaksi Periode</h3>
              <p>Seluruh order pada periode terpilih, termasuk yang masih pending atau diproses.</p>
            </div>
            {reportLoading ? (
              <p className="empty-state">Memuat laporan periode...</p>
            ) : reportOrders.length ? (
              <div className="table-wrap">
                <table className="menu-table report-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Waktu</th>
                      <th>Status</th>
                      <th>Bayar</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportOrders.map((order) => (
                      <tr key={`report-${order.id}`}>
                        <td>
                          <div className="report-order-cell">
                            <strong>#{order.orderNumber}</strong>
                            <span className="helper-text">{order.cashierName}</span>
                            <span className="helper-text">{getOrderItemsSummary(order)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="report-order-cell">
                            <span>{formatDate(order.createdAt)}</span>
                            <span className="helper-text">{formatTime(order.createdAt)}</span>
                          </div>
                        </td>
                        <td>
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td>
                          <span className="badge badge-accent">
                            {order.paymentMethod.toUpperCase()}
                          </span>
                        </td>
                        <td>{formatRupiah(order.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">Belum ada transaksi pada periode yang dipilih.</p>
            )}
          </article>

          <article className="card">
            <div className="card-heading">
              <h2>Menu Terlaris</h2>
              <p>Ranking berdasarkan jumlah item selesai pada periode terpilih.</p>
            </div>
            {reportSummary.topMenu.length ? (
              <div className="ranking-list">
                {reportSummary.topMenu.slice(0, 5).map((item, index) => (
                  <div className="ranking-item" key={item.name}>
                    <div className={`ranking-number ${index < 3 ? "top" : ""}`}>
                      {index + 1}
                    </div>
                    <div className="ranking-item-info">
                      <div className="ranking-item-name">{item.name}</div>
                      <div className="ranking-item-count">{item.count} item</div>
                    </div>
                    <div className="ranking-item-revenue">
                      {formatRupiah(item.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">Belum ada cukup data untuk ranking menu.</p>
            )}
          </article>

          <article className="card">
            <div className="card-heading">
              <h2>Workflow Pesanan</h2>
              <p>Omzet hanya dihitung dari order yang sudah selesai.</p>
            </div>
            <div className="workflow-summary">
              {workflowCounts.map(({ status, count, meta }) => (
                <div className="workflow-summary-card" key={status}>
                  <OrderStatusBadge status={status} />
                  <strong>{count} order</strong>
                  <span className="helper-text">{meta.description}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="card">
            <div className="card-heading">
              <h2>Metode Pembayaran</h2>
              <p>Komposisi pembayaran order selesai pada periode terpilih.</p>
            </div>
            <div className="summary-list">
              <div className="summary-row">
                <span>Cash</span>
                <strong>{formatRupiah(reportSummary.paymentBreakdown.cash)}</strong>
              </div>
              <div className="summary-row">
                <span>QRIS</span>
                <strong>{formatRupiah(reportSummary.paymentBreakdown.qris)}</strong>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

function CashierScreen({
  branchName,
  products,
  activeCategory,
  cart,
  paymentMethod,
  todayOrders,
  isSubmitting,
  error,
  notice,
  customizingProduct,
  selectedOptions,
  onLogout,
  onCategoryChange,
  onAddToCart,
  onQuantityChange,
  onPaymentChange,
  onCheckout,
  onOrderStatusChange,
  onPrintReceipt,
  onSelectChoice,
  onCloseCustomization,
  onConfirmCustomization,
}) {
  const availableProducts = products.filter((product) => product.isAvailable);
  const categories = getCategoryOptions(availableProducts);
  const workflowCounts = ORDER_STATUSES.map((status) => ({
    status,
    count: getOrderStatusCount(todayOrders, status),
  }));
  const visibleProducts =
    activeCategory === "all"
      ? availableProducts
      : availableProducts.filter((product) => product.category === activeCategory);

  return (
    <>
      <div className="kasir-layout">
        <section className="kasir-menu-section">
          <header className="kasir-header">
            <div className="kasir-header-left">
              <BrandMark compact inverted />
              <div>
                <h1>Kasir Sisikopi</h1>
                <p className="helper-text">Cabang aktif untuk transaksi cepat</p>
              </div>
              <span className="branch-badge">{branchName}</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={onLogout}>
              Logout
            </button>
          </header>

          <div className="status-slot">
            <StatusBanner error={error} notice={notice} />
          </div>

          <div className="category-tabs">
            {categories.map((category) => (
              <button
                key={category}
                className={`category-tab ${activeCategory === category ? "active" : ""}`}
                onClick={() => onCategoryChange(category)}
              >
                {category === "all" ? "Semua" : category}
              </button>
            ))}
          </div>

          <div className="menu-grid">
            {visibleProducts.map((product) => (
              <button
                key={product.id}
                className={`menu-card ${product.isAvailable ? "" : "unavailable"}`}
                onClick={() => onAddToCart(product)}
              >
                <span className="menu-card-emoji">{product.emoji}</span>
                <span className="menu-card-name">{product.name}</span>
                <span className="menu-card-price">{formatRupiah(product.basePrice)}</span>
                <span className="menu-card-meta">
                  {(product.options || []).length ? "Bisa custom" : "Siap tambah"}
                </span>
              </button>
            ))}
          </div>
        </section>

        <aside className="cart-panel">
          <div className="cart-header">
            <h2>
              Keranjang
              <span className="cart-count">{getCartQuantity(cart)}</span>
            </h2>
          </div>

          <div className="cart-items">
            {cart.length ? (
              cart.map((item) => (
                <div className="cart-item" key={item.id}>
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.productName}</div>
                    {item.selectedOptionsText ? (
                      <div className="cart-item-options">{item.selectedOptionsText}</div>
                    ) : null}
                    <div className="cart-item-price">{formatRupiah(item.subtotal)}</div>
                    <div className="cart-item-qty">
                      <button onClick={() => onQuantityChange(item.id, -1)}>-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => onQuantityChange(item.id, 1)}>+</button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="cart-empty">
                <div className="cart-empty-icon">Cart</div>
                <p>Belum ada menu dipilih.</p>
              </div>
            )}
          </div>

          <div className="cart-footer">
            <div className="payment-methods">
              <button
                className={`payment-method ${
                  paymentMethod === "cash" ? "selected" : ""
                }`}
                onClick={() => onPaymentChange("cash")}
              >
                <div className="payment-method-icon">Cash</div>
                <div className="payment-method-label">Tunai</div>
              </button>
              <button
                className={`payment-method ${
                  paymentMethod === "qris" ? "selected" : ""
                }`}
                onClick={() => onPaymentChange("qris")}
              >
                <div className="payment-method-icon">QRIS</div>
                <div className="payment-method-label">Scan</div>
              </button>
            </div>

            <div className="cart-total">
              <span>Total</span>
              <span className="cart-total-amount">{formatRupiah(getCartTotal(cart))}</span>
            </div>
            <div className="cart-actions">
              <button
                className="btn btn-primary"
                disabled={!cart.length || isSubmitting}
                onClick={onCheckout}
              >
                {isSubmitting ? "Menyimpan..." : "Checkout"}
              </button>
            </div>
          </div>
        </aside>

        <aside className="queue-panel">
          <div className="queue-header">
            <h2>Transaksi Hari Ini</h2>
          </div>
          <div className="queue-summary">
            {workflowCounts.map(({ status, count }) => (
              <div className="queue-summary-item" key={status}>
                <OrderStatusBadge status={status} />
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <div className="queue-list">
            {todayOrders.length ? (
              todayOrders.map((order, index) => (
                <div className={`queue-item ${index === 0 ? "newest" : ""}`} key={order.id}>
                  <div className="queue-item-header">
                    <div className="queue-item-title">
                      <span className="queue-item-number">#{order.orderNumber}</span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <span className="queue-item-time">{formatTime(order.createdAt)}</span>
                  </div>
                  <div className="queue-item-items">{getOrderItemsSummary(order)}</div>
                  <div className="queue-item-footer">
                    <div className="queue-item-actions">
                      <span className="badge badge-accent">{order.paymentMethod.toUpperCase()}</span>
                      <OrderWorkflowActions
                        order={order}
                        isSubmitting={isSubmitting}
                        onStatusChange={onOrderStatusChange}
                      />
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onPrintReceipt(order)}
                      >
                        Print
                      </button>
                    </div>
                    <span className="queue-item-total">{formatRupiah(order.totalAmount)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">Belum ada transaksi hari ini.</p>
            )}
          </div>
        </aside>
      </div>

      <CustomizationModal
        product={customizingProduct}
        selectedOptions={selectedOptions}
        onSelectChoice={onSelectChoice}
        onClose={onCloseCustomization}
        onConfirm={onConfirmCustomization}
      />
    </>
  );
}

export default function Home() {
  const [isBooting, setIsBooting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branches, setBranches] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [todayOrders, setTodayOrders] = useState([]);
  const [summary, setSummary] = useState(() => createEmptySummary());
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loginForm, setLoginForm] = useState(DEFAULT_LOGIN_FORM);
  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [toasts, setToasts] = useState([]);
  const toastTimeoutsRef = useRef(new Map());

  useEffect(
    () => () => {
      toastTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      toastTimeoutsRef.current.clear();
    },
    [],
  );

  function dismissToast(toastId) {
    const timeoutId = toastTimeoutsRef.current.get(toastId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      toastTimeoutsRef.current.delete(toastId);
    }

    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }

  function showToast(type, title, message, duration = 3200) {
    if (!message) {
      return;
    }

    const toastId = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((currentToasts) => [
      ...currentToasts.slice(-3),
      { id: toastId, type, title, message },
    ]);

    const timeoutId = setTimeout(() => {
      dismissToast(toastId);
    }, duration);
    toastTimeoutsRef.current.set(toastId, timeoutId);
  }

  function clearFeedback() {
    setError("");
    setNotice("");
  }

  function reportError(message, options = {}) {
    const { toast = true } = options;
    setError(message);
    setNotice("");
    if (toast) {
      showToast("error", "Ada masalah", message, 4200);
    }
  }

  function reportNotice(message, options = {}) {
    const { type = "success", surface = true, title } = options;
    if (surface) {
      setNotice(message);
      setError("");
    }
    showToast(type, title || (type === "info" ? "Informasi" : "Berhasil"), message);
  }

  function handlePrintReceipt(order, branchNameOverride) {
    const activeBranch =
      branchNameOverride ||
      branches.find((branch) => branch.id === order.branchId)?.name ||
      "Sisikopi";

    const printWindow = window.open("", "_blank", "width=420,height=640");
    if (!printWindow) {
      reportError("Popup print diblokir browser. Izinkan popup lalu coba lagi.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildReceiptHtml(order, activeBranch));
    printWindow.document.close();
    reportNotice(`Membuka struk order #${order.orderNumber}.`, {
      type: "info",
      title: "Menyiapkan struk",
      surface: false,
    });
  }

  async function refreshSessionData(session) {
    const nextSession = session ? getCurrentUser() || session : null;
    setCurrentUser(nextSession);

    if (!nextSession) {
      setUsers([]);
      setProducts([]);
      setTodayOrders([]);
      setSummary(createEmptySummary());
      return;
    }

    const [nextUsers, nextProducts, nextOrdersData, nextSummary] = await Promise.all([
      nextSession.role === "admin" ? getUsers() : Promise.resolve([]),
      getProducts(nextSession.branchId),
      getTodayOrders(nextSession.branchId),
      getDailySummary(nextSession.branchId),
    ]);
    setUsers(nextUsers || []);
    const normalizedProducts = nextProducts || [];
    const nextOrders = sortOrdersByWorkflow(nextOrdersData || []);

    setProducts(normalizedProducts);
    setTodayOrders(nextOrders);
    setSummary(nextSummary || createEmptySummary());
    setActiveCategory((currentCategory) =>
      currentCategory === "all" ||
      normalizedProducts.some((product) => product.category === currentCategory)
        ? currentCategory
        : "all",
    );
  }

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        await initializeData();
        const nextBranches = await getBranches();
        if (!mounted) {
          return;
        }

        setBranches(nextBranches);
        await refreshSessionData(getCurrentUser());
      } catch {
        if (mounted) {
          setError("Gagal memuat data awal aplikasi.");
        }
      } finally {
        if (mounted) {
          setIsBooting(false);
        }
      }
    }

    boot();

    return () => {
      mounted = false;
    };
  }, []);

  function updateLoginField(field, value) {
    setLoginForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function handleLogin(event) {
    event.preventDefault();
    setIsSubmitting(true);
    clearFeedback();

    const username = loginForm.email.trim();
    const password = loginForm.password.trim();
    if (!username || !password) {
      reportError("Username dan password wajib diisi.");
      setIsSubmitting(false);
      return;
    }

    try {
      const session = await login(
        username,
        password,
        loginForm.branchId,
      );

      if (!session) {
        reportError("Username atau password tidak cocok.");
        return;
      }

      setLoginForm((currentForm) => ({ ...currentForm, password: "" }));
      setCart([]);
      setPaymentMethod("cash");
      await refreshSessionData(session);
      reportNotice(`Masuk sebagai ${session.name}.`, {
        title: "Login berhasil",
      });
    } catch (loginError) {
      reportError(loginError.message || "Login gagal diproses. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLogout() {
    logout();
    setCart([]);
    setPaymentMethod("cash");
    setActiveCategory("all");
    setCustomizingProduct(null);
    setSelectedOptions([]);
    clearFeedback();
    void refreshSessionData(null);
    reportNotice("Sesi berhasil diakhiri.", {
      title: "Logout berhasil",
      surface: false,
    });
  }

  function addConfiguredItem(product, options) {
    const cartItem = buildCartItem(product, options);

    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.id === cartItem.id);
      if (existingItem) {
        return currentCart.map((item) =>
          item.id === cartItem.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.unitPrice,
              }
            : item,
        );
      }

      return [...currentCart, cartItem];
    });

    reportNotice(
      cartItem.selectedOptionsText
        ? `${product.name} ditambahkan (${cartItem.selectedOptionsText}).`
        : `${product.name} ditambahkan ke keranjang.`,
      {
        title: "Keranjang diperbarui",
        surface: false,
      },
    );
  }

  function handleAddToCart(product) {
    if ((product.options || []).length) {
      setCustomizingProduct(product);
      setSelectedOptions(buildDefaultSelections(product));
      clearFeedback();
      return;
    }

    addConfiguredItem(product, []);
  }

  function handleSelectChoice(group, choice) {
    setSelectedOptions((currentOptions) =>
      currentOptions.map((option) =>
        option.group === group.group
          ? {
              group: group.group,
              label: group.label || group.group,
              name: choice.name,
              extra: Number(choice.extra) || 0,
            }
          : option,
      ),
    );
  }

  function handleCloseCustomization() {
    setCustomizingProduct(null);
    setSelectedOptions([]);
  }

  function handleConfirmCustomization() {
    if (!customizingProduct) {
      return;
    }

    addConfiguredItem(customizingProduct, selectedOptions);
    handleCloseCustomization();
  }

  function handleQuantityChange(cartItemId, delta) {
    setCart((currentCart) =>
      currentCart.flatMap((item) => {
        if (item.id !== cartItemId) {
          return [item];
        }

        const nextQuantity = item.quantity + delta;
        if (nextQuantity <= 0) {
          return [];
        }

        return [
          {
            ...item,
            quantity: nextQuantity,
            subtotal: nextQuantity * item.unitPrice,
          },
        ];
      }),
    );
  }

  async function handleSaveProduct(productData, productId) {
    if (!currentUser) {
      return;
    }

    setIsSubmitting(true);
    clearFeedback();

    try {
      if (productId) {
        await updateProduct(productId, productData);
        reportNotice(`Menu ${productData.name} berhasil diperbarui.`, {
          title: "Menu diperbarui",
        });
      } else {
        await addProduct(productData);
        reportNotice(`Menu ${productData.name} berhasil ditambahkan.`, {
          title: "Menu ditambahkan",
        });
      }

      await refreshSessionData(currentUser);
    } catch (productError) {
      reportError(productError.message || "Perubahan menu gagal disimpan.");
      throw productError;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveUser(userData, userId) {
    if (!currentUser) {
      return;
    }

    setIsSubmitting(true);
    clearFeedback();

    try {
      let nextSession = currentUser;
      if (userId) {
        await updateUser(userId, userData);
        if (userId === currentUser.id) {
          nextSession = setCurrentUserSession({
            ...currentUser,
            name: userData.name,
            email: userData.email,
            role: userData.role,
            branchId: userData.branchId,
          });
        }
        reportNotice(`Akun ${userData.name} berhasil diperbarui.`, {
          title: "Akun diperbarui",
        });
      } else {
        await addUser(userData);
        reportNotice(`Akun ${userData.name} berhasil ditambahkan.`, {
          title: "Akun ditambahkan",
        });
      }

      await refreshSessionData(nextSession);
    } catch (userError) {
      reportError(userError.message || "Perubahan akun gagal disimpan.");
      throw userError;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteUser(userId) {
    if (!currentUser) {
      return;
    }

    if (userId === currentUser.id) {
      reportError("Akun yang sedang aktif tidak bisa dihapus.");
      return;
    }

    setIsSubmitting(true);
    clearFeedback();

    try {
      await deleteUser(userId);
      await refreshSessionData(currentUser);
      reportNotice("Akun berhasil dihapus.", {
        title: "Akun dihapus",
      });
    } catch (userError) {
      reportError(userError.message || "Akun gagal dihapus.");
      throw userError;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteProduct(productId) {
    if (!currentUser) {
      return;
    }

    setIsSubmitting(true);
    clearFeedback();

    try {
      await deleteProduct(productId);
      await refreshSessionData(currentUser);
      reportNotice("Menu berhasil dihapus dari katalog.", {
        title: "Menu dihapus",
      });
    } catch (productError) {
      reportError(productError.message || "Menu gagal dihapus.");
      throw productError;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleProductAvailability(product) {
    if (!currentUser) {
      return;
    }

    setIsSubmitting(true);
    clearFeedback();

    try {
      await updateProduct(product.id, { isAvailable: !product.isAvailable });
      await refreshSessionData(currentUser);
      reportNotice(
        product.isAvailable
          ? `${product.name} disembunyikan dari kasir.`
          : `${product.name} diaktifkan kembali.`,
        {
          title: "Status menu diubah",
        },
      );
    } catch (productError) {
      reportError(productError.message || "Status menu gagal diubah.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOrderStatusChange(order, nextStatus) {
    if (!currentUser || order.status === nextStatus) {
      return;
    }

    setIsSubmitting(true);
    clearFeedback();

    try {
      await updateOrderStatus(order.id, nextStatus);
      await refreshSessionData(currentUser);
      reportNotice(
        `Order #${order.orderNumber} dipindahkan ke ${getOrderStatusMeta(nextStatus).label}.`,
        {
          title: "Status order diperbarui",
        },
      );
    } catch (orderError) {
      reportError(orderError.message || "Status order gagal diperbarui.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCheckout() {
    if (!currentUser || !cart.length) {
      return;
    }

    setIsSubmitting(true);
    clearFeedback();

    try {
      const completedOrder = await createOrder({
        branchId: currentUser.branchId,
        cashierId: currentUser.id,
        cashierName: currentUser.name,
        paymentMethod,
        items: cart.map(({ id, ...item }) => item),
      });

      setCart([]);
      setPaymentMethod("cash");
      await refreshSessionData(currentUser);
      reportNotice("Pesanan masuk ke antrian pending.", {
        title: "Pesanan tersimpan",
      });
      handlePrintReceipt(completedOrder, currentBranch?.name || "Sisikopi");
    } catch (checkoutError) {
      reportError(checkoutError.message || "Checkout gagal diproses.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isBooting) {
    return (
      <div className="loading-screen">
        <div className="loading-card card">
          <BrandMark />
          <h1>Menyiapkan POS Sisikopi</h1>
          <p className="helper-text">Memuat data cabang, menu, dan transaksi terakhir.</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginScreen
          branches={branches}
          loginForm={loginForm}
          isSubmitting={isSubmitting}
          error={error}
          notice={notice}
          onFieldChange={updateLoginField}
          onSubmit={handleLogin}
        />
        <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const currentBranch =
    branches.find((branch) => branch.id === currentUser.branchId) || branches[0];

  if (currentUser.role === "admin") {
    return (
      <>
        <AdminScreen
          currentUser={currentUser}
          branchName={currentBranch?.name || "Cabang"}
          currentBranchId={currentUser.branchId}
          branches={branches}
          users={users}
          products={products}
          summary={summary}
          todayOrders={todayOrders}
          isSubmitting={isSubmitting}
          onLogout={handleLogout}
          onSaveUser={handleSaveUser}
          onDeleteUser={handleDeleteUser}
          onSaveProduct={handleSaveProduct}
          onDeleteProduct={handleDeleteProduct}
          onOrderStatusChange={handleOrderStatusChange}
          onPrintReceipt={handlePrintReceipt}
          onToggleProductAvailability={handleToggleProductAvailability}
          error={error}
          notice={notice}
        />
        <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <>
      <CashierScreen
        branchName={currentBranch?.name || "Cabang"}
        products={products}
        activeCategory={activeCategory}
        cart={cart}
        paymentMethod={paymentMethod}
        todayOrders={todayOrders}
        isSubmitting={isSubmitting}
        error={error}
        notice={notice}
        customizingProduct={customizingProduct}
        selectedOptions={selectedOptions}
        onLogout={handleLogout}
        onCategoryChange={setActiveCategory}
        onAddToCart={handleAddToCart}
        onQuantityChange={handleQuantityChange}
        onPaymentChange={setPaymentMethod}
        onCheckout={handleCheckout}
        onOrderStatusChange={handleOrderStatusChange}
        onPrintReceipt={handlePrintReceipt}
        onSelectChoice={handleSelectChoice}
        onCloseCustomization={handleCloseCustomization}
        onConfirmCustomization={handleConfirmCustomization}
      />
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
