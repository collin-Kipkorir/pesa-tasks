import { rtdbGet, rtdbSet, rtdbUpdate } from "./rtdb-server.js";

function rewardKey() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function fulfillSuccessfulPayment(paymentId) {
  const payment = await rtdbGet(`payments/${paymentId}`);
  if (!payment || payment.status !== "SUCCESS") return;
  if (payment.fulfilledAt) return;
  if (!payment.phone) return;

  const updates = {};
  let reward = null;

  if (payment.purpose === "activation") {
    updates.activated = true;
    reward = {
      amount: 0,
      source: "Account Activation",
      date: Date.now(),
      type: "activation",
    };
  } else if (payment.purpose === "vip") {
    updates.vip = true;
    reward = {
      amount: 0,
      source: "VIP Unlock",
      date: Date.now(),
      type: "vip",
    };
  }

  if (Object.keys(updates).length > 0) {
    await rtdbUpdate(`users/${payment.phone}`, updates);
  }

  if (reward) {
    await rtdbSet(`users/${payment.phone}/rewards/${rewardKey()}`, reward);
  }

  await rtdbUpdate(`payments/${paymentId}`, {
    fulfilledAt: Date.now(),
  });
}
