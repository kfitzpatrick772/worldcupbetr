"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { Prisma } from "../generated/prisma";
import {
  checkPassword,
  clearSessionCookie,
  requireAdmin,
  setSessionCookie,
} from "./auth";
import { getParticipantByPickToken, isContestantPicksLocked } from "./queries";
import { settle } from "./scoring/settle";

// ---- login throttle (in-memory; single admin) ------------------------------
let failCount = 0;
let lockedUntil = 0;

export async function login(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  if (Date.now() < lockedUntil) {
    return { error: "Too many attempts. Try again in a minute." };
  }
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    failCount++;
    if (failCount >= 5) {
      lockedUntil = Date.now() + 60_000;
      failCount = 0;
    }
    return { error: "Incorrect password." };
  }
  failCount = 0;
  await setSessionCookie();
  const next = String(formData.get("next") ?? "/admin");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logout() {
  await requireAdmin();
  await clearSessionCookie();
  redirect("/admin/login");
}

// ---- helpers ---------------------------------------------------------------
function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "player";
}

async function audit(action: string, note?: string, extra?: unknown) {
  await prisma.auditLog.create({
    data: {
      actor: "admin",
      action,
      note,
      after: extra === undefined ? undefined : (extra as Prisma.InputJsonValue),
    },
  });
}

// ---- settlement / lock -----------------------------------------------------
export async function settleNow() {
  await requireAdmin();
  const res = await settle("admin");
  await audit("settle", `settled ${res.participants} players`, res);
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
}

export async function toggleLock() {
  await requireAdmin();
  const state = await prisma.appState.findUnique({ where: { id: 1 } });
  const locked = !state?.picksLocked;
  await prisma.appState.upsert({
    where: { id: 1 },
    create: { id: 1, picksLocked: locked, lockedAt: locked ? new Date() : null },
    update: { picksLocked: locked, lockedAt: locked ? new Date() : null },
  });
  await audit(locked ? "lock-picks" : "unlock-picks");
  revalidatePath("/admin", "layout");
}

// ---- participants ----------------------------------------------------------
export async function createParticipant(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  let slug = slugify(name);
  let i = 1;
  while (await prisma.participant.findUnique({ where: { slug } })) {
    slug = `${slugify(name)}-${++i}`;
  }
  await prisma.participant.create({ data: { name, slug } });
  await audit("create-participant", name);
  // Settle so the new player immediately gets a Standing snapshot and appears
  // on the public board (without this they'd be counted but unlisted).
  await settle("admin");
  revalidatePath("/admin/participants");
  revalidatePath("/", "layout");
}

export async function deleteParticipant(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const p = await prisma.participant.findUnique({ where: { id } });
  await prisma.participant.delete({ where: { id } });
  await audit("delete-participant", p?.name);
  await settle("admin");
  revalidatePath("/admin/participants");
  revalidatePath("/", "layout");
}

// ---- PHASE 1: group-stage picks (pre-tournament) ---------------------------
// Group scorelines + group standings (top 2) + best-thirds. Does NOT touch
// knockout/final picks (those are phase 2). Blocked once group picks are locked.
export async function savePicks(formData: FormData) {
  await requireAdmin();
  const participantId = String(formData.get("participantId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!participantId) return;

  const state = await prisma.appState.findUnique({ where: { id: 1 } });
  if (state?.picksLocked) redirect(`/admin/picks/${slug}?locked=1`);

  const standings: { group: string; position: number; teamId: string }[] = [];
  const thirds = new Set<string>();
  for (const [key, raw] of formData.entries()) {
    const v = String(raw);
    if (!v) continue;
    if (key.startsWith("g_")) {
      const [, group, pos] = key.split("_");
      standings.push({ group, position: Number(pos), teamId: v });
    } else if (key === "third") {
      thirds.add(v);
    }
  }

  // group match scorelines: m_<matchId>_h / m_<matchId>_a
  const matchIds = new Set<string>();
  for (const key of formData.keys()) if (key.startsWith("m_")) matchIds.add(key.split("_")[1]);
  const matchPicks: { matchId: string; predHome: number; predAway: number }[] = [];
  for (const id of matchIds) {
    const h = formData.get(`m_${id}_h`);
    const a = formData.get(`m_${id}_a`);
    if (h !== "" && h != null && a !== "" && a != null) {
      matchPicks.push({ matchId: id, predHome: Number(h), predAway: Number(a) });
    }
  }
  const bestThird = [...thirds].slice(0, 8);

  await prisma.$transaction(async (tx) => {
    await tx.groupStandingPick.deleteMany({ where: { participantId } });
    await tx.groupMatchPick.deleteMany({ where: { participantId } });
    await tx.bestThirdPick.deleteMany({ where: { participantId } });
    if (standings.length)
      await tx.groupStandingPick.createMany({ data: standings.map((s) => ({ participantId, ...s })) });
    if (matchPicks.length)
      await tx.groupMatchPick.createMany({ data: matchPicks.map((m) => ({ participantId, ...m })) });
    if (bestThird.length)
      await tx.bestThirdPick.createMany({ data: bestThird.map((teamId) => ({ participantId, teamId })) });
  });

  await audit("save-group-picks", slug, { matches: matchPicks.length, standings: standings.length });
  await settle("admin");
  revalidatePath("/admin/participants");
  revalidatePath(`/admin/picks/${slug}`);
  redirect(`/admin/picks/${slug}?saved=1`);
}

// ---- PHASE 2: knockout bracket picks (after group stage) --------------------
// Admin enters each player's predicted winner of every knockout slot (M73..M104).
// We store KnockoutPick (editable source of truth) and DERIVE AdvancePick +
// FinalPick for scoring. Blocked once knockout picks are locked.
// Parse k_<slot> = predicted winner teamId from a bracket form.
function parseKnockoutPicks(formData: FormData): Record<string, string> {
  const picks: Record<string, string> = {};
  for (const [key, raw] of formData.entries()) {
    const v = String(raw);
    if (key.startsWith("k_") && v) picks[key.slice(2)] = v;
  }
  return picks;
}

// Store KnockoutPick (source of truth) + derived AdvancePick/FinalPick for one
// participant, replacing any prior picks. Shared by the admin and link paths.
async function persistKnockoutPicks(participantId: string, picks: Record<string, string>) {
  const { deriveKnockoutScoring } = await import("./bracket");
  const { advance, final } = deriveKnockoutScoring(picks);
  await prisma.$transaction(async (tx) => {
    await tx.knockoutPick.deleteMany({ where: { participantId } });
    await tx.advancePick.deleteMany({ where: { participantId } });
    await tx.finalPick.deleteMany({ where: { participantId } });
    const koData = Object.entries(picks).map(([slotLabel, teamId]) => ({ participantId, slotLabel, teamId }));
    if (koData.length) await tx.knockoutPick.createMany({ data: koData });
    if (advance.length) await tx.advancePick.createMany({ data: advance.map((a) => ({ participantId, ...a })) });
    if (final) await tx.finalPick.create({ data: { participantId, ...final } });
  });
}

export async function saveKnockout(formData: FormData) {
  await requireAdmin();
  const participantId = String(formData.get("participantId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!participantId) return;

  const state = await prisma.appState.findUnique({ where: { id: 1 } });
  if (state?.knockoutLocked) redirect(`/admin/knockout/${slug}?locked=1`);

  const picks = parseKnockoutPicks(formData);
  await persistKnockoutPicks(participantId, picks);

  await audit("save-knockout-picks", slug, { slots: Object.keys(picks).length });
  await settle("admin");
  revalidatePath("/admin/knockout");
  revalidatePath(`/admin/knockout/${slug}`);
  redirect(`/admin/knockout/${slug}?saved=1`);
}

// Contestant self-serve submit via their unique pick link. Identity comes
// STRICTLY from the token (never a client-sent participantId), so a tampered
// form can't edit someone else's bracket. Locks per isContestantPicksLocked.
export async function saveKnockoutViaToken(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const participant = await getParticipantByPickToken(token);
  if (!participant) redirect(`/picks/${token}`); // page renders 404 for a dead link

  if (await isContestantPicksLocked()) redirect(`/picks/${token}?locked=1`);

  const picks = parseKnockoutPicks(formData);
  await persistKnockoutPicks(participant.id, picks);

  await audit("submit-knockout-link", participant.slug, { slots: Object.keys(picks).length });
  await settle("contestant");
  revalidatePath("/", "layout");
  revalidatePath(`/picks/${token}`);
  redirect(`/picks/${token}?saved=1`);
}

// Admin: rotate a contestant's link token (invalidates the old URL).
export async function regeneratePickToken(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("participantId") ?? "");
  if (!id) return;
  await prisma.participant.update({
    where: { id },
    data: { pickToken: randomBytes(18).toString("base64url") },
  });
  await audit("regenerate-pick-token", id);
  revalidatePath("/admin/links");
}

// ---- knockout lock + team assignment ---------------------------------------
export async function toggleKnockoutLock() {
  await requireAdmin();
  const state = await prisma.appState.findUnique({ where: { id: 1 } });
  const locked = !state?.knockoutLocked;
  await prisma.appState.upsert({
    where: { id: 1 },
    create: { id: 1, knockoutLocked: locked, knockoutLockedAt: locked ? new Date() : null },
    update: { knockoutLocked: locked, knockoutLockedAt: locked ? new Date() : null },
  });
  await audit(locked ? "lock-knockout" : "unlock-knockout");
  revalidatePath("/admin", "layout");
}

// Assign actual teams to a knockout match (after the bracket is known).
export async function assignKnockoutTeams(formData: FormData) {
  await requireAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  if (!matchId) return;
  const homeTeamId = String(formData.get("homeTeamId") ?? "") || null;
  const awayTeamId = String(formData.get("awayTeamId") ?? "") || null;
  await prisma.match.update({ where: { id: matchId }, data: { homeTeamId, awayTeamId } });
  await audit("assign-knockout-teams", matchId, { homeTeamId, awayTeamId });
  revalidatePath("/admin/bracket");
  revalidatePath("/", "layout");
}

// Auto-fill the Round-of-32 group-position slots (1A/2B...) from finalized
// group standings. The 8 third-place slots stay for manual/API assignment.
export async function autofillR32() {
  await requireAdmin();
  const [standings, r32] = await Promise.all([
    prisma.groupStandingActual.findMany(),
    prisma.match.findMany({ where: { stage: "R32" } }),
  ]);
  const byGroupPos = new Map(standings.map((s) => [`${s.group}${s.position}`, s.teamId]));
  let filled = 0;
  for (const m of r32) {
    const data: { homeTeamId?: string; awayTeamId?: string } = {};
    if (m.homeSource && /^[12][A-L]$/.test(m.homeSource)) {
      const t = byGroupPos.get(`${m.homeSource[1]}${m.homeSource[0]}`);
      if (t) data.homeTeamId = t;
    }
    if (m.awaySource && /^[12][A-L]$/.test(m.awaySource)) {
      const t = byGroupPos.get(`${m.awaySource[1]}${m.awaySource[0]}`);
      if (t) data.awayTeamId = t;
    }
    if (Object.keys(data).length) {
      await prisma.match.update({ where: { id: m.id }, data });
      filled++;
    }
  }
  await audit("autofill-r32", `${filled} matches`);
  revalidatePath("/admin/bracket");
  revalidatePath("/", "layout");
}

// ---- match results ---------------------------------------------------------
export async function saveResult(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("matchId") ?? "");
  if (!id) return;
  const status = String(formData.get("status") ?? "SCHEDULED") as
    | "SCHEDULED"
    | "LIVE"
    | "FINISHED";
  const homeRaw = formData.get("homeScore");
  const awayRaw = formData.get("awayScore");
  const winnerTeamId = String(formData.get("winnerTeamId") ?? "") || null;

  const homeScore = homeRaw === "" || homeRaw == null ? null : Number(homeRaw);
  const awayScore = awayRaw === "" || awayRaw == null ? null : Number(awayRaw);

  await prisma.match.update({
    where: { id },
    data: {
      status,
      homeScore: status === "SCHEDULED" ? null : homeScore,
      awayScore: status === "SCHEDULED" ? null : awayScore,
      winnerTeamId,
    },
  });
  await audit("save-result", id, { status, homeScore, awayScore, winnerTeamId });
  await settle("admin");
  revalidatePath("/admin/results");
  revalidatePath("/", "layout");
}
