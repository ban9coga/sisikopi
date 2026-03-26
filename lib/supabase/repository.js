import {
  DEFAULT_BRANCHES,
  DEFAULT_PRODUCTS,
  DEFAULT_USERS,
} from "@/lib/local-store";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const ALLOWED_PAYMENT_METHODS = new Set(["cash", "qris"]);
const ALLOWED_ORDER_STATUSES = new Set(["pending", "processing", "done"]);
const ALLOWED_FINANCIAL_STATUSES = new Set(["active", "void", "refunded"]);

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getIsoDateKey(value) {
  return new Date(value).toISOString().split("T")[0];
}

function normalizeRange(startDate, endDate = startDate) {
  const today = getIsoDateKey(new Date());
  const safeStart = startDate || today;
  const safeEnd = endDate || safeStart;
  return safeStart <= safeEnd
    ? { startDate: safeStart, endDate: safeEnd }
    : { startDate: safeEnd, endDate: safeStart };
}

async function createPasswordHash(value) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeUserInput(input) {
  const name = String(input?.name || "").trim();
  const email = String(input?.email || "").trim().toLowerCase();
  const role = input?.role === "admin" ? "admin" : "kasir";
  const branchId = String(input?.branchId || "").trim();
  const password = String(input?.password || "");

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

  return { name, email, role, branchId, password };
}

function normalizeBranchInput(input) {
  const name = String(input?.name || "").trim();
  const address = String(input?.address || "").trim();

  if (!name) {
    throw new Error("Nama cabang wajib diisi.");
  }

  if (name.length > 60) {
    throw new Error("Nama cabang maksimal 60 karakter.");
  }

  return { name, address };
}

function sanitizeSession(user, branchId = user?.branch_id || user?.branchId) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    branchId,
  };
}

function mapBranch(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
  };
}

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    branchId: row.branch_id,
    createdAt: row.created_at,
  };
}

function sortByOrder(left, right) {
  return (left.sort_order || 0) - (right.sort_order || 0);
}

function mapProduct(row) {
  const optionGroups = [...(row.product_option_groups || [])]
    .sort(sortByOrder)
    .map((group) => ({
      group: group.group_key,
      label: group.label,
      choices: [...(group.product_option_choices || [])]
        .sort(sortByOrder)
        .map((choice) => ({
          name: choice.name,
          extra: Number(choice.extra_price) || 0,
        })),
    }));

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    basePrice: Number(row.base_price) || 0,
    emoji: row.emoji || "\u2615",
    isAvailable: row.is_available ?? true,
    branchId: row.branch_id || "all",
    options: optionGroups,
  };
}

function mapOrder(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    branchId: row.branch_id,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name,
    paymentMethod: row.payment_method,
    totalAmount: Number(row.total_amount) || 0,
    status: row.status,
    financialStatus: row.financial_status || "active",
    createdAt: row.created_at,
    completedAt: row.completed_at,
    voidedAt: row.voided_at,
    refundedAt: row.refunded_at,
    voidReason: row.void_reason || "",
    refundReason: row.refund_reason || "",
    items: [...(row.order_items || [])]
      .sort(sortByOrder)
      .map((item) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unit_price) || 0,
        subtotal: Number(item.subtotal) || 0,
        selectedOptions: item.selected_options_json || [],
        selectedOptionsText: item.selected_options_text || "",
      })),
  };
}

async function replaceProductOptions(client, productId, options = []) {
  const { error: deleteError } = await client
    .from("product_option_groups")
    .delete()
    .eq("product_id", productId);
  if (deleteError) {
    throw new Error(deleteError.message);
  }

  for (let groupIndex = 0; groupIndex < options.length; groupIndex += 1) {
    const group = options[groupIndex];
    const groupId = createId("pog");
    const { error: groupError } = await client.from("product_option_groups").insert({
      id: groupId,
      product_id: productId,
      group_key: group.group,
      label: group.label,
      sort_order: groupIndex,
    });

    if (groupError) {
      throw new Error(groupError.message);
    }

    if ((group.choices || []).length) {
      const choiceRows = group.choices.map((choice, choiceIndex) => ({
        id: createId("poc"),
        option_group_id: groupId,
        name: choice.name,
        extra_price: Number(choice.extra) || 0,
        sort_order: choiceIndex,
      }));

      const { error: choiceError } = await client
        .from("product_option_choices")
        .insert(choiceRows);

      if (choiceError) {
        throw new Error(choiceError.message);
      }
    }
  }
}

async function seedDefaultProducts(client) {
  for (const product of DEFAULT_PRODUCTS) {
    const { error: productError } = await client.from("products").insert({
      id: product.id,
      name: product.name,
      category: product.category,
      base_price: Number(product.basePrice) || 0,
      emoji: product.emoji || "\u2615",
      is_available: product.isAvailable ?? true,
      branch_id: product.branchId === "all" ? null : product.branchId,
    });

    if (productError) {
      throw new Error(productError.message);
    }

    await replaceProductOptions(client, product.id, product.options || []);
  }
}

export async function ensureSeedData() {
  const client = getSupabaseAdminClient();

  const { data: existingBranches, error: existingBranchesError } = await client
    .from("branches")
    .select("id");
  if (existingBranchesError) {
    throw new Error(existingBranchesError.message);
  }

  const existingBranchIds = new Set((existingBranches || []).map((branch) => branch.id));
  const missingDefaultBranches = DEFAULT_BRANCHES.filter(
    (branch) => !existingBranchIds.has(branch.id),
  );

  if (missingDefaultBranches.length) {
    const { error: branchSeedError } = await client
      .from("branches")
      .insert(missingDefaultBranches);
    if (branchSeedError) {
      throw new Error(branchSeedError.message);
    }
  }

  const { data: existingUsers, error: existingUsersError } = await client
    .from("app_users")
    .select("id");
  if (existingUsersError) {
    throw new Error(existingUsersError.message);
  }

  const existingIds = new Set((existingUsers || []).map((user) => user.id));
  const missingDefaultUsers = DEFAULT_USERS.filter((user) => !existingIds.has(user.id));

  if (missingDefaultUsers.length) {
    const seededUsers = await Promise.all(
      missingDefaultUsers.map(async ({ password, branchId, ...user }) => ({
        ...user,
        branch_id: branchId,
        password_hash: await createPasswordHash(password),
      })),
    );

    const { error: userSeedError } = await client.from("app_users").insert(seededUsers);
    if (userSeedError) {
      throw new Error(userSeedError.message);
    }
  }

  const { error: deleteLegacyUsersError } = await client
    .from("app_users")
    .delete()
    .in("email", ["kasir1", "kasir2"]);
  if (deleteLegacyUsersError) {
    throw new Error(deleteLegacyUsersError.message);
  }

  const { data: productRows, error: productError } = await client
    .from("products")
    .select("id")
    .limit(1);
  if (productError) {
    throw new Error(productError.message);
  }

  if (!productRows.length) {
    await seedDefaultProducts(client);
  }
}

export async function authenticateUser(email, password, branchId) {
  await ensureSeedData();
  const client = getSupabaseAdminClient();
  const normalizedEmail = email.trim();
  const passwordHash = await createPasswordHash(password);

  const { data, error } = await client
    .from("app_users")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.password_hash !== passwordHash) {
    return null;
  }

  return sanitizeSession(data, branchId || data.branch_id);
}

export async function listBranches() {
  await ensureSeedData();
  const client = getSupabaseAdminClient();
  const { data, error } = await client.from("branches").select("*").order("name");
  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(mapBranch);
}

export async function createBranchRecord(input) {
  await ensureSeedData();
  const client = getSupabaseAdminClient();
  const normalizedInput = normalizeBranchInput(input);

  const payload = {
    id: createId("branch"),
    name: normalizedInput.name,
    address: normalizedInput.address,
  };

  const { error } = await client.from("branches").insert(payload);
  if (error) {
    throw new Error(error.message);
  }

  return payload.id;
}

export async function updateBranchRecord(branchId, updates) {
  await ensureSeedData();
  const client = getSupabaseAdminClient();
  const normalizedInput = normalizeBranchInput(updates);

  const { error } = await client
    .from("branches")
    .update({
      name: normalizedInput.name,
      address: normalizedInput.address,
    })
    .eq("id", branchId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteBranchRecord(branchId) {
  await ensureSeedData();
  const client = getSupabaseAdminClient();

  const { data: currentBranch, error: currentBranchError } = await client
    .from("branches")
    .select("id")
    .eq("id", branchId)
    .maybeSingle();
  if (currentBranchError) {
    throw new Error(currentBranchError.message);
  }

  if (!currentBranch) {
    throw new Error("Cabang tidak ditemukan.");
  }

  const { count: branchCount, error: branchCountError } = await client
    .from("branches")
    .select("*", { count: "exact", head: true });
  if (branchCountError) {
    throw new Error(branchCountError.message);
  }

  if ((branchCount || 0) <= 1) {
    throw new Error("Minimal harus ada satu cabang.");
  }

  const { count: userCount, error: userCountError } = await client
    .from("app_users")
    .select("*", { count: "exact", head: true })
    .eq("branch_id", branchId);
  if (userCountError) {
    throw new Error(userCountError.message);
  }

  if ((userCount || 0) > 0) {
    throw new Error("Cabang masih dipakai oleh akun operasional.");
  }

  const { count: orderCount, error: orderCountError } = await client
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("branch_id", branchId);
  if (orderCountError) {
    throw new Error(orderCountError.message);
  }

  if ((orderCount || 0) > 0) {
    throw new Error("Cabang masih memiliki histori transaksi.");
  }

  const { count: productCount, error: productCountError } = await client
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("branch_id", branchId);
  if (productCountError) {
    throw new Error(productCountError.message);
  }

  if ((productCount || 0) > 0) {
    throw new Error("Cabang masih dipakai sebagai scope menu.");
  }

  const { error } = await client.from("branches").delete().eq("id", branchId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function listUsers() {
  await ensureSeedData();
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("app_users")
    .select("id, name, email, role, branch_id, created_at")
    .order("role", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(mapUser);
}

export async function listProducts(branchId) {
  await ensureSeedData();
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("products")
    .select(`
      id,
      name,
      category,
      base_price,
      emoji,
      is_available,
      branch_id,
      product_option_groups (
        id,
        group_key,
        label,
        sort_order,
        product_option_choices (
          id,
          name,
          extra_price,
          sort_order
        )
      )
    `)
    .order("category")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  const products = (data || []).map(mapProduct);
  if (!branchId) {
    return products;
  }

  return products.filter((product) => product.branchId === "all" || product.branchId === branchId);
}

export async function createProductRecord(input) {
  await ensureSeedData();
  const client = getSupabaseAdminClient();
  const productId = createId("product");
  const payload = {
    id: productId,
    name: input.name,
    category: input.category,
    base_price: Number(input.basePrice) || 0,
    emoji: input.emoji || "\u2615",
    is_available: input.isAvailable ?? true,
    branch_id: input.branchId === "all" ? null : input.branchId,
  };

  const { error } = await client.from("products").insert(payload);
  if (error) {
    throw new Error(error.message);
  }

  await replaceProductOptions(client, productId, input.options || []);
  return productId;
}

export async function createUserRecord(input) {
  await ensureSeedData();
  const client = getSupabaseAdminClient();
  const normalizedInput = normalizeUserInput(input);

  if (!normalizedInput.password || normalizedInput.password.length < 8) {
    throw new Error("Password akun minimal 8 karakter.");
  }

  const payload = {
    id: createId("user"),
    name: normalizedInput.name,
    email: normalizedInput.email,
    role: normalizedInput.role,
    branch_id: normalizedInput.branchId,
    password_hash: await createPasswordHash(normalizedInput.password),
  };

  const { error } = await client.from("app_users").insert(payload);
  if (error) {
    throw new Error(error.message);
  }

  return payload.id;
}

export async function updateUserRecord(userId, updates) {
  await ensureSeedData();
  const client = getSupabaseAdminClient();
  const normalizedInput = normalizeUserInput(updates);

  const { data: currentUser, error: currentUserError } = await client
    .from("app_users")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (currentUserError) {
    throw new Error(currentUserError.message);
  }

  if (!currentUser) {
    throw new Error("Akun tidak ditemukan.");
  }

  if (currentUser.role === "admin" && normalizedInput.role !== "admin") {
    const { count, error: adminCountError } = await client
      .from("app_users")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if (adminCountError) {
      throw new Error(adminCountError.message);
    }

    if ((count || 0) <= 1) {
      throw new Error("Minimal harus ada satu akun admin.");
    }
  }

  const payload = {
    name: normalizedInput.name,
    email: normalizedInput.email,
    role: normalizedInput.role,
    branch_id: normalizedInput.branchId,
  };

  if (normalizedInput.password) {
    if (normalizedInput.password.length < 8) {
      throw new Error("Password akun minimal 8 karakter.");
    }

    payload.password_hash = await createPasswordHash(normalizedInput.password);
  }

  const { error } = await client.from("app_users").update(payload).eq("id", userId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteUserRecord(userId) {
  await ensureSeedData();
  const client = getSupabaseAdminClient();

  const { data: currentUser, error: currentUserError } = await client
    .from("app_users")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (currentUserError) {
    throw new Error(currentUserError.message);
  }

  if (!currentUser) {
    throw new Error("Akun tidak ditemukan.");
  }

  if (currentUser.role === "admin") {
    const { count, error: adminCountError } = await client
      .from("app_users")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if (adminCountError) {
      throw new Error(adminCountError.message);
    }

    if ((count || 0) <= 1) {
      throw new Error("Minimal harus ada satu akun admin.");
    }
  }

  const { error } = await client.from("app_users").delete().eq("id", userId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function updateProductRecord(productId, updates) {
  await ensureSeedData();
  const client = getSupabaseAdminClient();
  const payload = {
    name: updates.name,
    category: updates.category,
    base_price: Number(updates.basePrice) || 0,
    emoji: updates.emoji || "\u2615",
    is_available: updates.isAvailable ?? true,
    branch_id: updates.branchId === "all" ? null : updates.branchId,
  };

  const { error } = await client.from("products").update(payload).eq("id", productId);
  if (error) {
    throw new Error(error.message);
  }

  await replaceProductOptions(client, productId, updates.options || []);
}

export async function deleteProductRecord(productId) {
  await ensureSeedData();
  const client = getSupabaseAdminClient();
  const { error } = await client.from("products").delete().eq("id", productId);
  if (error) {
    throw new Error(error.message);
  }
}

async function listOrdersInternal(branchId, startDate, endDate) {
  await ensureSeedData();
  const client = getSupabaseAdminClient();
  const range = normalizeRange(startDate, endDate);
  let query = client
    .from("orders")
    .select(`
      id,
      order_number,
      branch_id,
      cashier_id,
      cashier_name,
      payment_method,
      total_amount,
      status,
      financial_status,
      created_at,
      completed_at,
      voided_at,
      refunded_at,
      void_reason,
      refund_reason,
      order_items (
        id,
        product_id,
        product_name,
        quantity,
        unit_price,
        subtotal,
        selected_options_json,
        selected_options_text,
        sort_order
      )
    `)
    .gte("created_at", `${range.startDate}T00:00:00.000Z`)
    .lte("created_at", `${range.endDate}T23:59:59.999Z`)
    .order("created_at", { ascending: false });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(mapOrder);
}

export async function listOrdersByDate(branchId, startDate, endDate) {
  return listOrdersInternal(branchId, startDate, endDate);
}

export async function listTodayOrders(branchId) {
  const today = getIsoDateKey(new Date());
  return listOrdersInternal(branchId, today, today);
}

function buildSelectedOptionsText(selectedOptions) {
  return selectedOptions.map((option) => `${option.label}: ${option.name}`).join(", ");
}

function normalizeSelectedOptions(product, rawSelectedOptions) {
  const selections = new Map(
    (rawSelectedOptions || []).map((option) => [option.group, option.name]),
  );

  return (product.options || []).map((group) => {
    const choice =
      group.choices.find((item) => item.name === selections.get(group.group)) || group.choices[0];

    return {
      group: group.group,
      label: group.label || group.group,
      name: choice.name,
      extra: Number(choice.extra) || 0,
    };
  });
}

function normalizeOrderItems(products, items) {
  const productLookup = new Map(products.map((product) => [product.id, product]));

  return (items || [])
    .map((item) => {
      const product = productLookup.get(item.productId);
      const quantity = Math.max(1, Number(item.quantity) || 0);

      if (!product || !product.isAvailable || quantity < 1) {
        return null;
      }

      const selectedOptions = normalizeSelectedOptions(product, item.selectedOptions);
      const optionsExtra = selectedOptions.reduce(
        (sum, option) => sum + (Number(option.extra) || 0),
        0,
      );
      const unitPrice = (Number(product.basePrice) || 0) + optionsExtra;

      return {
        id: createId("order-item"),
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice,
        subtotal: unitPrice * quantity,
        selectedOptions,
        selectedOptionsText: buildSelectedOptionsText(selectedOptions),
      };
    })
    .filter(Boolean);
}

export async function createOrderRecord(orderData) {
  await ensureSeedData();
  if (!orderData?.branchId) {
    throw new Error("Cabang pesanan belum dipilih.");
  }

  const products = await listProducts(orderData.branchId);
  const items = normalizeOrderItems(products, orderData.items);
  if (!items.length) {
    throw new Error("Tambahkan minimal satu menu sebelum checkout.");
  }

  const paymentMethod = ALLOWED_PAYMENT_METHODS.has(orderData.paymentMethod)
    ? orderData.paymentMethod
    : "cash";
  const todayOrders = await listTodayOrders(orderData.branchId);
  const order = {
    id: createId("order"),
    orderNumber: String(todayOrders.length + 1).padStart(3, "0"),
    branchId: orderData.branchId,
    cashierId: orderData.cashierId || null,
    cashierName: orderData.cashierName || "Kasir",
    paymentMethod,
    totalAmount: items.reduce((sum, item) => sum + item.subtotal, 0),
    status: "pending",
    financialStatus: "active",
    createdAt: new Date().toISOString(),
    completedAt: null,
    voidedAt: null,
    refundedAt: null,
    voidReason: "",
    refundReason: "",
    items,
  };

  const client = getSupabaseAdminClient();
  const { error: orderError } = await client.from("orders").insert({
    id: order.id,
    order_number: order.orderNumber,
    branch_id: order.branchId,
    cashier_id: order.cashierId,
    cashier_name: order.cashierName,
    payment_method: order.paymentMethod,
    total_amount: order.totalAmount,
    status: order.status,
    financial_status: order.financialStatus,
    created_at: order.createdAt,
    completed_at: order.completedAt,
    voided_at: order.voidedAt,
    refunded_at: order.refundedAt,
    void_reason: order.voidReason,
    refund_reason: order.refundReason,
  });

  if (orderError) {
    throw new Error(orderError.message);
  }

  const orderItemRows = order.items.map((item, index) => ({
    id: item.id,
    order_id: order.id,
    product_id: item.productId,
    product_name: item.productName,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    subtotal: item.subtotal,
    selected_options_json: item.selectedOptions,
    selected_options_text: item.selectedOptionsText,
    sort_order: index,
  }));
  const { error: itemError } = await client.from("order_items").insert(orderItemRows);
  if (itemError) {
    throw new Error(itemError.message);
  }

  return order;
}

export async function updateOrderStatusRecord(orderId, status) {
  if (!ALLOWED_ORDER_STATUSES.has(status)) {
    throw new Error("Status order tidak valid.");
  }

  await ensureSeedData();
  const client = getSupabaseAdminClient();
  const { data: currentOrder, error: currentError } = await client
    .from("orders")
    .select("id, branch_id, completed_at, financial_status")
    .eq("id", orderId)
    .maybeSingle();

  if (currentError) {
    throw new Error(currentError.message);
  }
  if (!currentOrder) {
    throw new Error("Order tidak ditemukan.");
  }

  if ((currentOrder.financial_status || "active") !== "active") {
    throw new Error("Order yang sudah void/refund tidak bisa ubah workflow.");
  }

  const { error } = await client
    .from("orders")
    .update({
      status,
      completed_at: status === "done" ? currentOrder.completed_at || new Date().toISOString() : null,
    })
    .eq("id", orderId);

  if (error) {
    throw new Error(error.message);
  }

  return listTodayOrders(currentOrder.branch_id);
}

export async function updateOrderFinancialStatusRecord(orderId, financialStatus, reason = "") {
  if (!ALLOWED_FINANCIAL_STATUSES.has(financialStatus) || financialStatus === "active") {
    throw new Error("Status finansial order tidak valid.");
  }

  await ensureSeedData();
  const client = getSupabaseAdminClient();
  const { data: currentOrder, error: currentError } = await client
    .from("orders")
    .select("id, branch_id, status, financial_status, voided_at, refunded_at")
    .eq("id", orderId)
    .maybeSingle();

  if (currentError) {
    throw new Error(currentError.message);
  }

  if (!currentOrder) {
    throw new Error("Order tidak ditemukan.");
  }

  if ((currentOrder.financial_status || "active") !== "active") {
    throw new Error("Order sudah pernah di-void atau direfund.");
  }

  if (financialStatus === "void" && currentOrder.status === "done") {
    throw new Error("Order yang sudah selesai harus diproses sebagai refund.");
  }

  if (financialStatus === "refunded" && currentOrder.status !== "done") {
    throw new Error("Hanya order selesai yang bisa direfund.");
  }

  const reasonValue = String(reason || "").trim();
  const timestamp = new Date().toISOString();
  const { error } = await client
    .from("orders")
    .update({
      financial_status: financialStatus,
      voided_at: financialStatus === "void" ? timestamp : currentOrder.voided_at,
      refunded_at:
        financialStatus === "refunded" ? timestamp : currentOrder.refunded_at,
      void_reason: financialStatus === "void" ? reasonValue : null,
      refund_reason: financialStatus === "refunded" ? reasonValue : null,
    })
    .eq("id", orderId);

  if (error) {
    throw new Error(error.message);
  }

  return listTodayOrders(currentOrder.branch_id);
}

export async function getSummaryByRangeRecord(branchId, startDate, endDate = startDate) {
  const orders = await listOrdersByDate(branchId, startDate, endDate);
  const doneOrders = orders.filter(
    (order) => order.status === "done" && (order.financialStatus || "active") === "active",
  );

  const totalRevenue = doneOrders.reduce(
    (sum, order) => sum + (Number(order.totalAmount) || 0),
    0,
  );
  const totalTransactions = doneOrders.length;
  const avgTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const menuCount = {};
  const paymentBreakdown = { cash: 0, qris: 0 };
  const statusBreakdown = { pending: 0, processing: 0, done: 0 };
  const financialBreakdown = { active: 0, void: 0, refunded: 0 };

  orders.forEach((order) => {
    statusBreakdown[order.status] = (statusBreakdown[order.status] || 0) + 1;
    financialBreakdown[order.financialStatus || "active"] =
      (financialBreakdown[order.financialStatus || "active"] || 0) + 1;
  });

  doneOrders.forEach((order) => {
    paymentBreakdown[order.paymentMethod] =
      (paymentBreakdown[order.paymentMethod] || 0) + (Number(order.totalAmount) || 0);

    (order.items || []).forEach((item) => {
      if (!menuCount[item.productName]) {
        menuCount[item.productName] = { count: 0, revenue: 0 };
      }

      menuCount[item.productName].count += Number(item.quantity) || 0;
      menuCount[item.productName].revenue += Number(item.subtotal) || 0;
    });
  });

  const range = normalizeRange(startDate, endDate);
  return {
    totalRevenue,
    totalTransactions,
    avgTicket,
    totalOrders: orders.length,
    paymentBreakdown,
    statusBreakdown,
    financialBreakdown,
    topMenu: Object.entries(menuCount)
      .map(([name, data]) => ({ name, ...data }))
      .sort((left, right) => right.count - left.count),
    orders: doneOrders,
    startDate: range.startDate,
    endDate: range.endDate,
  };
}
