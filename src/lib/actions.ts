"use server";

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
  revalidatePath("/admin/participants");
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

// ---- pick entry (admin transcribes each player's bracket) ------------------
export async function savePicks(formData: FormData) {
  await requireAdmin();
  const participantId = String(formData.get("participantId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!participantId) return;

  const state = await prisma.appState.findUnique({ where: { id: 1 } });
  if (state?.picksLocked) {
    redirect(`/admin/picks/${slug}?locked=1`);
  }

  const standings: { group: string; position: number; teamId: string }[] = [];
  const thirds = new Set<string>();
  const advanceKeys = new Set<string>();
  const advance: { round: "R16" | "QF" | "SF" | "FINAL"; teamId: string }[] = [];

  for (const [key, raw] of formData.entries()) {
    const v = String(raw);
    if (!v) continue;
    if (key.startsWith("g_")) {
      const [, group, pos] = key.split("_");
      standings.push({ group, position: Number(pos), teamId: v });
    } else if (key === "third") {
      thirds.add(v);
    } else if (key.startsWith("adv_")) {
      const round = key.slice(4) as "R16" | "QF" | "SF" | "FINAL";
      const k = `${round}:${v}`;
      if (!advanceKeys.has(k)) {
        advanceKeys.add(k);
        advance.push({ round, teamId: v });
      }
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

  const champion = String(formData.get("champion") ?? "") || null;
  const runnerUp = String(formData.get("runnerUp") ?? "") || null;
  const thirdPlace = String(formData.get("thirdPlace") ?? "") || null;
  const bestThird = [...thirds].slice(0, 8);

  await prisma.$transaction(async (tx) => {
    await tx.groupStandingPick.deleteMany({ where: { participantId } });
    await tx.groupMatchPick.deleteMany({ where: { participantId } });
    await tx.bestThirdPick.deleteMany({ where: { participantId } });
    await tx.advancePick.deleteMany({ where: { participantId } });
    await tx.finalPick.deleteMany({ where: { participantId } });

    if (standings.length)
      await tx.groupStandingPick.createMany({ data: standings.map((s) => ({ participantId, ...s })) });
    if (matchPicks.length)
      await tx.groupMatchPick.createMany({ data: matchPicks.map((m) => ({ participantId, ...m })) });
    if (bestThird.length)
      await tx.bestThirdPick.createMany({ data: bestThird.map((teamId) => ({ participantId, teamId })) });
    if (advance.length)
      await tx.advancePick.createMany({ data: advance.map((a) => ({ participantId, ...a })) });
    if (champion && runnerUp && thirdPlace)
      await tx.finalPick.create({
        data: { participantId, championTeamId: champion, runnerUpTeamId: runnerUp, thirdPlaceTeamId: thirdPlace },
      });
  });

  await audit("save-picks", slug, { matches: matchPicks.length, standings: standings.length });
  await settle("admin");
  revalidatePath("/admin/participants");
  revalidatePath(`/admin/picks/${slug}`);
  redirect(`/admin/picks/${slug}?saved=1`);
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
