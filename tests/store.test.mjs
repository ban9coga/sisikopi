import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

const localStorage = new MemoryStorage();
const browserWindow = {
  localStorage,
  crypto: webcrypto,
};
globalThis.window = browserWindow;
globalThis.localStorage = localStorage;

async function loadStoreModule() {
  const source = await readFile(path.resolve("lib/local-store.js"), "utf8");
  const moduleUrl = `data:text/javascript;base64,${globalThis.Buffer.from(source).toString("base64")}`;
  return import(moduleUrl);
}

const {
  createOrder,
  getOrdersByDate,
  getSummaryByRange,
  updateOrderStatus,
} = await loadStoreModule();

function resetStorage() {
  localStorage.clear();
}

function getStoredOrders() {
  return JSON.parse(localStorage.getItem("sisikopi_orders") || "[]");
}

const testCases = [
  {
    name: "createOrder recalculates pricing from product options and starts pending",
    run() {
      resetStorage();

      const order = createOrder({
        branchId: "branch-1",
        cashierId: "user-2",
        cashierName: "Kasir 1",
        paymentMethod: "cash",
        items: [
          {
            productId: "p2",
            quantity: 2,
            selectedOptions: [
              { group: "size", name: "Large" },
              { group: "sugar", name: "Less Sugar" },
              { group: "temperature", name: "Ice Normal" },
              { group: "topping", name: "Extra Shot" },
            ],
          },
        ],
      });

      assert.equal(order.status, "pending");
      assert.equal(order.completedAt, null);
      assert.equal(order.items[0].unitPrice, 29000);
      assert.equal(order.items[0].subtotal, 58000);
      assert.equal(order.totalAmount, 58000);
      assert.match(order.items[0].selectedOptionsText, /Size: Large/);
      assert.match(order.items[0].selectedOptionsText, /Topping: Extra Shot/);
    },
  },
  {
    name: "updateOrderStatus keeps workflow timestamps consistent",
    run() {
      resetStorage();

      const order = createOrder({
        branchId: "branch-1",
        cashierId: "user-2",
        cashierName: "Kasir 1",
        paymentMethod: "cash",
        items: [{ productId: "p11", quantity: 1, selectedOptions: [] }],
      });

      let orders = updateOrderStatus(order.id, "processing");
      let currentOrder = orders.find((item) => item.id === order.id);
      assert.equal(currentOrder.status, "processing");
      assert.equal(currentOrder.completedAt, null);

      orders = updateOrderStatus(order.id, "done");
      currentOrder = orders.find((item) => item.id === order.id);
      assert.equal(currentOrder.status, "done");
      assert.ok(currentOrder.completedAt);

      orders = updateOrderStatus(order.id, "processing");
      currentOrder = orders.find((item) => item.id === order.id);
      assert.equal(currentOrder.status, "processing");
      assert.equal(currentOrder.completedAt, null);
    },
  },
  {
    name: "getSummaryByRange reports status totals for all orders but revenue only from done orders",
    run() {
      resetStorage();

      const firstOrder = createOrder({
        branchId: "branch-1",
        cashierId: "user-2",
        cashierName: "Kasir 1",
        paymentMethod: "cash",
        items: [{ productId: "p11", quantity: 1, selectedOptions: [] }],
      });
      const secondOrder = createOrder({
        branchId: "branch-1",
        cashierId: "user-2",
        cashierName: "Kasir 1",
        paymentMethod: "qris",
        items: [
          {
            productId: "p12",
            quantity: 1,
            selectedOptions: [{ group: "flavor", name: "Cheese" }],
          },
        ],
      });

      updateOrderStatus(firstOrder.id, "done");
      updateOrderStatus(secondOrder.id, "processing");

      const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const storedOrders = getStoredOrders();
      storedOrders.push({
        ...firstOrder,
        id: "historic-order",
        orderNumber: "900",
        status: "done",
        totalAmount: 99999,
        createdAt: yesterdayIso,
        completedAt: yesterdayIso,
      });
      localStorage.setItem("sisikopi_orders", JSON.stringify(storedOrders));

      const today = firstOrder.createdAt.split("T")[0];
      const yesterday = yesterdayIso.split("T")[0];
      const todaySummary = getSummaryByRange("branch-1", today, today);
      const todayOrders = getOrdersByDate("branch-1", today, today);

      assert.equal(todayOrders.length, 2);
      assert.equal(todaySummary.totalOrders, 2);
      assert.equal(todaySummary.totalTransactions, 1);
      assert.equal(todaySummary.totalRevenue, 15000);
      assert.equal(todaySummary.avgTicket, 15000);
      assert.deepEqual(todaySummary.statusBreakdown, {
        pending: 0,
        processing: 1,
        done: 1,
      });
      assert.equal(todaySummary.paymentBreakdown.cash, 15000);
      assert.equal(todaySummary.paymentBreakdown.qris, 0);

      const rangeSummary = getSummaryByRange("branch-1", yesterday, today);
      assert.equal(rangeSummary.totalOrders, 3);
      assert.equal(rangeSummary.totalTransactions, 2);
      assert.equal(rangeSummary.totalRevenue, 114999);
    },
  },
  {
    name: "updateOrderStatus rejects unknown workflow values",
    run() {
      resetStorage();

      const order = createOrder({
        branchId: "branch-1",
        cashierId: "user-2",
        cashierName: "Kasir 1",
        paymentMethod: "cash",
        items: [{ productId: "p11", quantity: 1, selectedOptions: [] }],
      });

      assert.throws(
        () => updateOrderStatus(order.id, "cancelled"),
        /Status order tidak valid/,
      );
    },
  },
];

let failedCount = 0;
for (const testCase of testCases) {
  try {
    await testCase.run();
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    failedCount += 1;
    console.error(`FAIL ${testCase.name}`);
    console.error(error);
  }
}

if (failedCount > 0) {
  globalThis.process.exitCode = 1;
} else {
  console.log(`Passed ${testCases.length} store tests.`);
}
