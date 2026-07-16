const tcb = require("@cloudbase/node-sdk");
const { z } = require("zod");

const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
const db = app.database();

const actionSchema = z.object({
  action: z.string().min(1),
  payload: z.unknown().optional(),
});

const householdPayload = z.object({ householdId: z.string().min(1) });

function currentUid() {
  const { uid } = app.auth().getUserInfo();
  if (!uid) throw new Error("UNAUTHENTICATED");
  return uid;
}

async function getMembership(uid, householdId) {
  const result = await db.collection("memberships").where({ uid, householdId, status: "active" }).limit(1).get();
  if (!result.data.length) throw new Error("FORBIDDEN");
  return result.data[0];
}

async function getCurrentUser(uid) {
  const result = await db.collection("users").where({ uid }).limit(1).get();
  if (result.data.length) return result.data[0];
  const now = new Date().toISOString();
  const created = await db.collection("users").add({ uid, createdAt: now, updatedAt: now });
  return { _id: created.id, uid, createdAt: now, updatedAt: now };
}

async function listByHousehold(collectionName, householdId, extra = {}) {
  return (await db.collection(collectionName).where({ householdId, ...extra }).get()).data;
}

async function bootstrap(uid) {
  const user = await getCurrentUser(uid);
  const memberships = (await db.collection("memberships").where({ uid, status: "active" }).get()).data;
  if (!memberships.length) return { user, household: null, members: [] };
  const membership = memberships[0];
  const household = (await db.collection("households").doc(membership.householdId).get()).data?.[0] ?? null;
  const members = await listByHousehold("members", membership.householdId);
  return { user, household, members, membership };
}

async function createHousehold(uid, rawPayload) {
  const payload = z.object({ name: z.string().trim().min(1).max(40) }).parse(rawPayload);
  const existing = (await db.collection("memberships").where({ uid, status: "active" }).limit(1).get()).data;
  if (existing.length) throw new Error("ALREADY_IN_HOUSEHOLD");
  const now = new Date().toISOString();
  const householdResult = await db.collection("households").add({ name: payload.name, ownerUid: uid, createdAt: now, updatedAt: now });
  const householdId = householdResult.id;
  await db.collection("memberships").add({ uid, householdId, role: "owner", status: "active", joinedAt: now });
  await db.collection("members").add({ householdId, uid, name: "我", managed: false, healthShared: false, createdAt: now, updatedAt: now });
  return { householdId };
}

async function createInvite(uid, rawPayload) {
  const { householdId } = householdPayload.parse(rawPayload);
  const membership = await getMembership(uid, householdId);
  if (membership.role !== "owner") throw new Error("OWNER_REQUIRED");
  const token = crypto.randomUUID().replaceAll("-", "");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await db.collection("invites").add({ householdId, token, createdBy: uid, expiresAt, usedAt: null, createdAt: new Date().toISOString() });
  return { token, expiresAt };
}

async function upsertOwnedDocument(uid, collectionName, rawPayload) {
  const payload = z.object({ householdId: z.string().min(1), document: z.record(z.string(), z.unknown()), id: z.string().optional() }).parse(rawPayload);
  await getMembership(uid, payload.householdId);
  const document = { ...payload.document, householdId: payload.householdId, updatedAt: new Date().toISOString() };
  if (payload.id) {
    const existing = (await db.collection(collectionName).doc(payload.id).get()).data?.[0];
    if (!existing || existing.householdId !== payload.householdId) throw new Error("NOT_FOUND");
    await db.collection(collectionName).doc(payload.id).update(document);
    return { id: payload.id };
  }
  const result = await db.collection(collectionName).add({ ...document, createdAt: new Date().toISOString() });
  return { id: result.id };
}

async function addVital(uid, rawPayload) {
  const payload = z.object({ householdId: z.string(), memberId: z.string(), record: z.record(z.string(), z.unknown()) }).parse(rawPayload);
  await getMembership(uid, payload.householdId);
  const member = (await db.collection("members").doc(payload.memberId).get()).data?.[0];
  if (!member || member.householdId !== payload.householdId) throw new Error("NOT_FOUND");
  if (!member.managed && member.uid !== uid) throw new Error("SELF_EDIT_REQUIRED");
  const result = await db.collection("vitals").add({ ...payload.record, householdId: payload.householdId, memberId: payload.memberId, createdBy: uid, createdAt: new Date().toISOString() });
  return { id: result.id };
}

async function confirmMeal(uid, rawPayload) {
  const payload = z.object({ householdId: z.string(), mealId: z.string(), allocations: z.record(z.string(), z.number().nonnegative()) }).parse(rawPayload);
  await getMembership(uid, payload.householdId);
  const meal = (await db.collection("meals").doc(payload.mealId).get()).data?.[0];
  if (!meal || meal.householdId !== payload.householdId) throw new Error("NOT_FOUND");
  const snapshot = { ...meal, status: "confirmed", allocations: payload.allocations, confirmedAt: new Date().toISOString(), confirmedBy: uid };
  await db.collection("meals").doc(payload.mealId).update({ status: "confirmed", allocations: payload.allocations, confirmedAt: snapshot.confirmedAt, confirmedBy: uid });
  await db.collection("intakeSnapshots").add({ householdId: payload.householdId, mealId: payload.mealId, snapshot, createdAt: snapshot.confirmedAt });
  return { confirmedAt: snapshot.confirmedAt };
}

async function exportData(uid, rawPayload) {
  const { householdId } = householdPayload.parse(rawPayload);
  await getMembership(uid, householdId);
  const member = (await db.collection("members").where({ householdId, uid }).limit(1).get()).data?.[0] ?? null;
  if (!member) return { profile: null, vitals: [], intake: [] };
  const vitals = (await db.collection("vitals").where({ householdId, memberId: member._id }).get()).data;
  const intake = (await db.collection("intakeSnapshots").where({ householdId }).get()).data.filter((item) => JSON.stringify(item.snapshot).includes(member._id));
  return { exportedAt: new Date().toISOString(), profile: member, vitals, intake };
}

exports.main = async (event) => {
  try {
    const uid = currentUid();
    const { action, payload } = actionSchema.parse(event);
    let data;
    if (action === "bootstrap") data = await bootstrap(uid);
    else if (action === "household.create") data = await createHousehold(uid, payload);
    else if (action === "household.invite") data = await createInvite(uid, payload);
    else if (action === "members.list") { const { householdId } = householdPayload.parse(payload); await getMembership(uid, householdId); data = await listByHousehold("members", householdId); }
    else if (action === "recipes.list") { const { householdId } = householdPayload.parse(payload); await getMembership(uid, householdId); data = await listByHousehold("recipes", householdId); }
    else if (action === "recipes.upsert") data = await upsertOwnedDocument(uid, "recipes", payload);
    else if (action === "meals.list") { const parsed = householdPayload.extend({ date: z.string().optional() }).parse(payload); await getMembership(uid, parsed.householdId); data = await listByHousehold("meals", parsed.householdId, parsed.date ? { date: parsed.date } : {}); }
    else if (action === "meals.upsert") data = await upsertOwnedDocument(uid, "meals", payload);
    else if (action === "meals.confirm") data = await confirmMeal(uid, payload);
    else if (action === "vitals.list") { const parsed = householdPayload.extend({ memberId: z.string() }).parse(payload); await getMembership(uid, parsed.householdId); data = await listByHousehold("vitals", parsed.householdId, { memberId: parsed.memberId }); }
    else if (action === "vitals.add") data = await addVital(uid, payload);
    else if (action === "shopping.get") { const { householdId } = householdPayload.parse(payload); await getMembership(uid, householdId); data = await listByHousehold("shoppingLists", householdId); }
    else if (action === "shopping.save") data = await upsertOwnedDocument(uid, "shoppingLists", payload);
    else if (action === "data.export") data = await exportData(uid, payload);
    else throw new Error("UNKNOWN_ACTION");
    return { ok: true, data };
  } catch (error) {
    console.error("nutrition-api", { message: error.message });
    return { ok: false, error: error.message === "UNAUTHENTICATED" ? "请先登录" : "请求未完成", code: error.message };
  }
};
