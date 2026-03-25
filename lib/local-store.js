const STORAGE_KEYS = {
  USERS: "sisikopi_users",
  PRODUCTS: "sisikopi_products",
  ORDERS: "sisikopi_orders",
  BRANCHES: "sisikopi_branches",
  CURRENT_USER: "sisikopi_current_user",
};

const ALLOWED_PAYMENT_METHODS = new Set(["cash", "qris"]);
const ALLOWED_ORDER_STATUSES = new Set(["pending", "processing", "done"]);

export const DEFAULT_BRANCHES = [
  { id: "branch-1", name: "Cabang Sutomo", address: "Padang" },
  { id: "branch-2", name: "Sisi Kopi Bandar Purus", address: "Padang" },
];

export const DEFAULT_USERS = [
  {
    id: "user-1",
    name: "Owner",
    email: "admin",
    password: "adminsisikopi",
    role: "admin",
    branchId: "branch-1",
  },
  {
    id: "user-2",
    name: "Barista",
    email: "barista",
    password: "baristasisikopi",
    role: "kasir",
    branchId: "branch-1",
  },
];

function createChoices(definitions) {
  return definitions.map(([name, extra = 0]) => ({ name, extra }));
}

function cloneOptions(options = []) {
  return options.map((group) => ({
    ...group,
    choices: group.choices.map((choice) => ({ ...choice })),
  }));
}

const DRINK_SIZE_OPTIONS = createChoices([
  ["Regular", 0],
  ["Large", 4000],
]);

const DRINK_SUGAR_OPTIONS = createChoices([
  ["Normal", 0],
  ["Less Sugar", 0],
  ["No Sugar", 0],
]);

const DRINK_ICE_OPTIONS = createChoices([
  ["Hot", 0],
  ["Ice Normal", 2000],
  ["Less Ice", 2000],
]);

const ICED_ONLY_OPTIONS = createChoices([
  ["Ice Normal", 0],
  ["Less Ice", 0],
  ["No Ice", 0],
]);

const COFFEE_TOPPING_OPTIONS = createChoices([
  ["No Topping", 0],
  ["Extra Shot", 5000],
  ["Whipped Cream", 3000],
]);

const SWEET_DRINK_TOPPING_OPTIONS = createChoices([
  ["No Topping", 0],
  ["Whipped Cream", 3000],
  ["Boba", 5000],
]);

const TOAST_FLAVOR_OPTIONS = createChoices([
  ["Chocolate", 0],
  ["Cheese", 3000],
  ["Chocolate Cheese", 4000],
]);

const FRIES_SAUCE_OPTIONS = createChoices([
  ["Tomato Sauce", 0],
  ["Mayonnaise", 0],
  ["BBQ", 2000],
]);

const FRIED_BANANA_TOPPING_OPTIONS = createChoices([
  ["No Topping", 0],
  ["Chocolate", 2000],
  ["Cheese", 3000],
]);

function createOptionGroup(group, label, choices) {
  return {
    group,
    label,
    choices,
  };
}

function createProduct({
  id,
  name,
  category,
  basePrice,
  emoji,
  options = [],
}) {
  return {
    id,
    name,
    category,
    basePrice,
    emoji,
    isAvailable: true,
    branchId: "all",
    options: cloneOptions(options),
  };
}

export const DEFAULT_PRODUCTS = [
  createProduct({
    id: "p1",
    name: "Espresso",
    category: "kopi",
    basePrice: 15000,
    emoji: "\u2615",
    options: [
      createOptionGroup("temperature", "Serving", createChoices([["Hot", 0]])),
      createOptionGroup("topping", "Topping", createChoices([["No Topping", 0], ["Extra Shot", 5000]])),
    ],
  }),
  createProduct({
    id: "p2",
    name: "Americano",
    category: "kopi",
    basePrice: 18000,
    emoji: "\u2615",
    options: [
      createOptionGroup("size", "Size", DRINK_SIZE_OPTIONS),
      createOptionGroup("sugar", "Sugar", DRINK_SUGAR_OPTIONS),
      createOptionGroup("temperature", "Serving", DRINK_ICE_OPTIONS),
      createOptionGroup("topping", "Topping", createChoices([["No Topping", 0], ["Extra Shot", 5000]])),
    ],
  }),
  createProduct({
    id: "p3",
    name: "Caffe Latte",
    category: "kopi",
    basePrice: 22000,
    emoji: "\uD83E\uDD5B",
    options: [
      createOptionGroup("size", "Size", DRINK_SIZE_OPTIONS),
      createOptionGroup("sugar", "Sugar", DRINK_SUGAR_OPTIONS),
      createOptionGroup("temperature", "Serving", DRINK_ICE_OPTIONS),
      createOptionGroup("topping", "Topping", [...COFFEE_TOPPING_OPTIONS, { name: "Boba", extra: 5000 }]),
    ],
  }),
  createProduct({
    id: "p4",
    name: "Cappuccino",
    category: "kopi",
    basePrice: 22000,
    emoji: "\u2615",
    options: [
      createOptionGroup("size", "Size", DRINK_SIZE_OPTIONS),
      createOptionGroup("sugar", "Sugar", DRINK_SUGAR_OPTIONS),
      createOptionGroup("temperature", "Serving", DRINK_ICE_OPTIONS),
      createOptionGroup("topping", "Topping", COFFEE_TOPPING_OPTIONS),
    ],
  }),
  createProduct({
    id: "p5",
    name: "Mocha Latte",
    category: "kopi",
    basePrice: 25000,
    emoji: "\uD83C\uDF6B",
    options: [
      createOptionGroup("size", "Size", DRINK_SIZE_OPTIONS),
      createOptionGroup("sugar", "Sugar", DRINK_SUGAR_OPTIONS),
      createOptionGroup("temperature", "Serving", DRINK_ICE_OPTIONS),
      createOptionGroup("topping", "Topping", [...COFFEE_TOPPING_OPTIONS, { name: "Boba", extra: 5000 }]),
    ],
  }),
  createProduct({
    id: "p6",
    name: "Kopi Susu",
    category: "kopi",
    basePrice: 18000,
    emoji: "\uD83E\uDD64",
    options: [
      createOptionGroup("size", "Size", DRINK_SIZE_OPTIONS),
      createOptionGroup("sugar", "Sugar", createChoices([["Normal", 0], ["Less Sugar", 0], ["Extra Sweet", 0]])),
      createOptionGroup("temperature", "Ice", ICED_ONLY_OPTIONS),
      createOptionGroup("topping", "Topping", createChoices([["No Topping", 0], ["Extra Shot", 5000], ["Boba", 5000]])),
    ],
  }),
  createProduct({
    id: "p7",
    name: "Matcha Latte",
    category: "non-kopi",
    basePrice: 23000,
    emoji: "\uD83C\uDF75",
    options: [
      createOptionGroup("size", "Size", DRINK_SIZE_OPTIONS),
      createOptionGroup("sugar", "Sugar", DRINK_SUGAR_OPTIONS),
      createOptionGroup("temperature", "Serving", DRINK_ICE_OPTIONS),
      createOptionGroup("topping", "Topping", SWEET_DRINK_TOPPING_OPTIONS),
    ],
  }),
  createProduct({
    id: "p8",
    name: "Coklat",
    category: "non-kopi",
    basePrice: 20000,
    emoji: "\uD83C\uDF6B",
    options: [
      createOptionGroup("size", "Size", DRINK_SIZE_OPTIONS),
      createOptionGroup("sugar", "Sugar", DRINK_SUGAR_OPTIONS),
      createOptionGroup("temperature", "Serving", DRINK_ICE_OPTIONS),
      createOptionGroup("topping", "Topping", createChoices([["No Topping", 0], ["Whipped Cream", 3000], ["Marshmallow", 3000]])),
    ],
  }),
  createProduct({
    id: "p9",
    name: "Thai Tea",
    category: "non-kopi",
    basePrice: 18000,
    emoji: "\uD83E\uDDCB",
    options: [
      createOptionGroup("size", "Size", DRINK_SIZE_OPTIONS),
      createOptionGroup("sugar", "Sugar", createChoices([["Normal", 0], ["Less Sugar", 0], ["Extra Sweet", 0]])),
      createOptionGroup("temperature", "Ice", ICED_ONLY_OPTIONS),
      createOptionGroup("topping", "Topping", createChoices([["No Topping", 0], ["Boba", 5000]])),
    ],
  }),
  createProduct({
    id: "p10",
    name: "Taro Latte",
    category: "non-kopi",
    basePrice: 22000,
    emoji: "\uD83D\uDFE3",
    options: [
      createOptionGroup("size", "Size", DRINK_SIZE_OPTIONS),
      createOptionGroup("sugar", "Sugar", DRINK_SUGAR_OPTIONS),
      createOptionGroup("temperature", "Serving", DRINK_ICE_OPTIONS),
      createOptionGroup("topping", "Topping", createChoices([["No Topping", 0], ["Boba", 5000]])),
    ],
  }),
  createProduct({
    id: "p11",
    name: "Croissant",
    category: "snack",
    basePrice: 15000,
    emoji: "\uD83E\uDD50",
  }),
  createProduct({
    id: "p12",
    name: "Roti Bakar",
    category: "snack",
    basePrice: 12000,
    emoji: "\uD83C\uDF5E",
    options: [createOptionGroup("flavor", "Flavor", TOAST_FLAVOR_OPTIONS)],
  }),
  createProduct({
    id: "p13",
    name: "French Fries",
    category: "snack",
    basePrice: 15000,
    emoji: "\uD83C\uDF5F",
    options: [createOptionGroup("sauce", "Sauce", FRIES_SAUCE_OPTIONS)],
  }),
  createProduct({
    id: "p14",
    name: "Pisang Goreng",
    category: "snack",
    basePrice: 10000,
    emoji: "\uD83C\uDF4C",
    options: [createOptionGroup("topping", "Topping", FRIED_BANANA_TOPPING_OPTIONS)],
  }),
];

const DEFAULT_PRODUCTS_BY_ID = new Map(
  DEFAULT_PRODUCTS.map((product) => [product.id, product]),
);

function getStorage(key, defaultValue) {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStorage(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(key, JSON.stringify(value));
}

function createUniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeSession(user, branchId = user?.branchId) {
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

function isBrokenEmoji(value) {
  return typeof value === "string" && (value.includes("ð") || value.includes("â"));
}

function sanitizeProduct(product) {
  const fallback = DEFAULT_PRODUCTS_BY_ID.get(product.id);
  if (!fallback) {
    return {
      ...product,
      basePrice: Number(product.basePrice) || 0,
      options: cloneOptions(product.options || []),
      isAvailable: product.isAvailable ?? true,
    };
  }

  const mergedOptions = Array.isArray(product.options)
    ? cloneOptions(product.options)
    : cloneOptions(fallback.options);

  return {
    ...fallback,
    ...product,
    basePrice: Number(product.basePrice ?? fallback.basePrice) || 0,
    emoji: !product.emoji || isBrokenEmoji(product.emoji) ? fallback.emoji : product.emoji,
    options: mergedOptions,
    isAvailable: product.isAvailable ?? fallback.isAvailable,
  };
}

function getNormalizedProducts() {
  const products = getStorage(STORAGE_KEYS.PRODUCTS, []);
  let shouldPersist = false;

  const normalizedProducts = products.map((product) => {
    const normalizedProduct = sanitizeProduct(product);
    if (JSON.stringify(normalizedProduct) !== JSON.stringify(product)) {
      shouldPersist = true;
    }

    return normalizedProduct;
  });

  if (!products.length) {
    return DEFAULT_PRODUCTS.map((product) => sanitizeProduct(product));
  }

  if (shouldPersist) {
    setStorage(STORAGE_KEYS.PRODUCTS, normalizedProducts);
  }

  return normalizedProducts;
}

async function createPasswordHash(value) {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return value;
  }

  const buffer = await window.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getNormalizedUsers() {
  const users = getStorage(STORAGE_KEYS.USERS, []);
  let shouldPersist = false;

  const normalizedUsers = await Promise.all(
    users.map(async (user) => {
      if (user.passwordHash && !("password" in user)) {
        return user;
      }

      if (user.passwordHash && "password" in user) {
        shouldPersist = true;
        const { password, ...safeUser } = user;
        return safeUser;
      }

      if (user.password) {
        shouldPersist = true;
        const { password, ...safeUser } = user;
        return {
          ...safeUser,
          passwordHash: await createPasswordHash(password),
        };
      }

      return user;
    }),
  );

  if (shouldPersist) {
    setStorage(STORAGE_KEYS.USERS, normalizedUsers);
  }

  return normalizedUsers;
}

async function seedDefaultUsers() {
  return Promise.all(
    DEFAULT_USERS.map(async ({ password, ...user }) => ({
      ...user,
      passwordHash: await createPasswordHash(password),
    })),
  );
}

function normalizeSelectedOptions(product, rawSelectedOptions) {
  const selections = new Map(
    (rawSelectedOptions || []).map((option) => [option.group, option.name]),
  );

  return (product.options || []).map((group) => {
    const choice =
      group.choices.find((item) => item.name === selections.get(group.group)) ||
      group.choices[0];

    return {
      group: group.group,
      label: group.label || group.group,
      name: choice.name,
      extra: Number(choice.extra) || 0,
    };
  });
}

function buildItemSignature(productId, selectedOptions) {
  return [
    productId,
    ...selectedOptions.map((option) => `${option.group}:${option.name}`),
  ].join("|");
}

function buildItemPricing(product, selectedOptions, quantity) {
  const optionsExtra = selectedOptions.reduce(
    (sum, option) => sum + (Number(option.extra) || 0),
    0,
  );
  const unitPrice = (Number(product.basePrice) || 0) + optionsExtra;
  const safeQuantity = Math.max(1, Number(quantity) || 0);

  return {
    unitPrice,
    subtotal: unitPrice * safeQuantity,
  };
}

function buildSelectedOptionsText(selectedOptions) {
  return selectedOptions.map((option) => `${option.label}: ${option.name}`).join(", ");
}

function getIsoDateKey(value) {
  return new Date(value).toISOString().split("T")[0];
}

function normalizeCartItems(items, branchId) {
  const availableProducts = getProducts(branchId);
  const productLookup = new Map(
    availableProducts.map((product) => [product.id, product]),
  );

  return (items ?? [])
    .map((item) => {
      const product = productLookup.get(item.productId);
      const quantity = Math.max(1, Number(item.quantity) || 0);

      if (!product || !product.isAvailable || quantity < 1) {
        return null;
      }

      const selectedOptions = normalizeSelectedOptions(product, item.selectedOptions);
      const pricing = buildItemPricing(product, selectedOptions, quantity);

      return {
        id: buildItemSignature(product.id, selectedOptions),
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: pricing.unitPrice,
        subtotal: pricing.subtotal,
        selectedOptions,
        selectedOptionsText: buildSelectedOptionsText(selectedOptions),
      };
    })
    .filter(Boolean);
}

export async function initializeData() {
  if (!getStorage(STORAGE_KEYS.BRANCHES, null)) {
    setStorage(STORAGE_KEYS.BRANCHES, DEFAULT_BRANCHES);
  }

  const products = getStorage(STORAGE_KEYS.PRODUCTS, null);
  if (!products) {
    setStorage(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS.map((product) => sanitizeProduct(product)));
  } else {
    getNormalizedProducts();
  }

  if (!getStorage(STORAGE_KEYS.ORDERS, null)) {
    setStorage(STORAGE_KEYS.ORDERS, []);
  }

  if (!getStorage(STORAGE_KEYS.USERS, null)) {
    setStorage(STORAGE_KEYS.USERS, await seedDefaultUsers());
  } else {
    await getNormalizedUsers();
  }

  const currentUser = getCurrentUser();
  if (currentUser) {
    setStorage(STORAGE_KEYS.CURRENT_USER, currentUser);
  }
}

export async function login(email, password, branchId) {
  const users = await getNormalizedUsers();
  const passwordHash = await createPasswordHash(password);
  const user = users.find(
    (candidate) =>
      candidate.email === email.trim() &&
      candidate.passwordHash === passwordHash,
  );

  if (!user) {
    return null;
  }

  const session = sanitizeSession(user, branchId || user.branchId);
  setStorage(STORAGE_KEYS.CURRENT_USER, session);
  return session;
}

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
}

export function getCurrentUser() {
  const currentUser = getStorage(STORAGE_KEYS.CURRENT_USER, null);
  if (!currentUser) {
    return null;
  }

  const safeSession = sanitizeSession(currentUser);
  if (JSON.stringify(currentUser) !== JSON.stringify(safeSession)) {
    setStorage(STORAGE_KEYS.CURRENT_USER, safeSession);
  }

  return safeSession;
}

export function getBranches() {
  return getStorage(STORAGE_KEYS.BRANCHES, DEFAULT_BRANCHES);
}

export function getBranchName(branchId) {
  const branches = getBranches();
  const branch = branches.find((candidate) => candidate.id === branchId);
  return branch ? branch.name : "";
}

export function getProducts(branchId) {
  const products = getStorage(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS).map(sanitizeProduct);
  if (!branchId) {
    return products;
  }

  return products.filter(
    (product) => product.branchId === "all" || product.branchId === branchId,
  );
}

export function addProduct(product) {
  const products = getStorage(STORAGE_KEYS.PRODUCTS, []);
  const nextProducts = [
    ...products,
    sanitizeProduct({
      ...product,
      id: createUniqueId("p"),
      basePrice: Number(product.basePrice) || 0,
      isAvailable: product.isAvailable ?? true,
      options: product.options ?? [],
    }),
  ];

  setStorage(STORAGE_KEYS.PRODUCTS, nextProducts);
  return nextProducts;
}

export function updateProduct(id, updates) {
  const products = getStorage(STORAGE_KEYS.PRODUCTS, []);
  const nextProducts = products.map((product) =>
    product.id === id
      ? sanitizeProduct({
          ...product,
          ...updates,
          basePrice: Number(updates.basePrice ?? product.basePrice) || 0,
        })
      : sanitizeProduct(product),
  );

  setStorage(STORAGE_KEYS.PRODUCTS, nextProducts);
  return nextProducts;
}

export function deleteProduct(id) {
  const products = getStorage(STORAGE_KEYS.PRODUCTS, []);
  const nextProducts = products.filter((product) => product.id !== id);
  setStorage(STORAGE_KEYS.PRODUCTS, nextProducts);
  return nextProducts;
}

export function getOrders(branchId) {
  const orders = getStorage(STORAGE_KEYS.ORDERS, []);
  if (!branchId) {
    return orders;
  }

  return orders.filter((order) => order.branchId === branchId);
}

export function getTodayOrders(branchId) {
  const today = getIsoDateKey(new Date());
  return getOrders(branchId).filter(
    (order) => getIsoDateKey(order.createdAt) === today,
  );
}

export function createOrder(orderData) {
  if (!orderData?.branchId) {
    throw new Error("Cabang pesanan belum dipilih.");
  }

  const items = normalizeCartItems(orderData.items, orderData.branchId);
  if (!items.length) {
    throw new Error("Tambahkan minimal satu menu sebelum checkout.");
  }

  const paymentMethod = ALLOWED_PAYMENT_METHODS.has(orderData.paymentMethod)
    ? orderData.paymentMethod
    : "cash";

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
  const orders = getStorage(STORAGE_KEYS.ORDERS, []);
  const orderDateKey = getIsoDateKey(new Date());
  const todayOrders = orders.filter(
    (order) => getIsoDateKey(order.createdAt) === orderDateKey && order.branchId === orderData.branchId,
  );

  const order = {
    id: createUniqueId("order"),
    orderNumber: String(todayOrders.length + 1).padStart(3, "0"),
    branchId: orderData.branchId,
    cashierId: orderData.cashierId || null,
    cashierName: orderData.cashierName || "Kasir",
    items,
    paymentMethod,
    totalAmount,
    status: "pending",
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  const nextOrders = [...orders, order];
  setStorage(STORAGE_KEYS.ORDERS, nextOrders);
  return order;
}

export function updateOrderStatus(orderId, status) {
  if (!ALLOWED_ORDER_STATUSES.has(status)) {
    throw new Error("Status order tidak valid.");
  }

  const orders = getStorage(STORAGE_KEYS.ORDERS, []);
  const nextOrders = orders.map((order) =>
    order.id === orderId
      ? {
          ...order,
          status,
          completedAt:
            status === "done"
              ? order.completedAt || new Date().toISOString()
              : null,
        }
      : order,
  );

  setStorage(STORAGE_KEYS.ORDERS, nextOrders);
  return nextOrders;
}

export function getOrdersByDate(branchId, startDate, endDate) {
  const orders = getOrders(branchId);
  const safeStartDate = startDate || getIsoDateKey(new Date());
  const safeEndDate = endDate || safeStartDate;
  return orders.filter((order) => {
    const dateKey = getIsoDateKey(order.createdAt);
    return dateKey >= safeStartDate && dateKey <= safeEndDate;
  });
}

export function getSummaryByRange(branchId, startDate, endDate = startDate) {
  const safeStartDate = startDate || new Date().toISOString().split("T")[0];
  const safeEndDate = endDate || safeStartDate;
  const orders = getOrdersByDate(branchId, safeStartDate, safeEndDate);
  const doneOrders = orders.filter((order) => order.status === "done");

  const totalRevenue = doneOrders.reduce(
    (sum, order) => sum + (Number(order.totalAmount) || 0),
    0,
  );
  const totalTransactions = doneOrders.length;
  const avgTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const menuCount = {};
  const statusBreakdown = { pending: 0, processing: 0, done: 0 };

  orders.forEach((order) => {
    statusBreakdown[order.status] = (statusBreakdown[order.status] || 0) + 1;
  });

  doneOrders.forEach((order) => {
    (order.items ?? []).forEach((item) => {
      if (!menuCount[item.productName]) {
        menuCount[item.productName] = { count: 0, revenue: 0 };
      }

      menuCount[item.productName].count += Number(item.quantity) || 0;
      menuCount[item.productName].revenue += Number(item.subtotal) || 0;
    });
  });

  const topMenu = Object.entries(menuCount)
    .map(([name, data]) => ({ name, ...data }))
    .sort((left, right) => right.count - left.count);

  const paymentBreakdown = { cash: 0, qris: 0 };
  doneOrders.forEach((order) => {
    paymentBreakdown[order.paymentMethod] =
      (paymentBreakdown[order.paymentMethod] || 0) +
      (Number(order.totalAmount) || 0);
  });

  return {
    totalRevenue,
    totalTransactions,
    avgTicket,
    topMenu,
    paymentBreakdown,
    orders: doneOrders,
    totalOrders: orders.length,
    statusBreakdown,
    startDate: safeStartDate,
    endDate: safeEndDate,
  };
}

export function getDailySummary(branchId, date) {
  const dateStr = date || new Date().toISOString().split("T")[0];
  return getSummaryByRange(branchId, dateStr, dateStr);
}

export function formatRupiah(amount) {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Number(amount) || 0)}`;
}

export function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
