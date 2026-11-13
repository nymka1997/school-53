import "server-only";

import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadServiceAccount(): ServiceAccount | null {
  let raw: Record<string, unknown> | null = null;

  // 1. Vercel дээрх Environment Variable-аас унших
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    raw = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else {
    // 2. Локал компьютер дээр service-account.json файл байвал унших
    const serviceAccountPath = path.join(process.cwd(), "service-account.json");
    if (existsSync(serviceAccountPath)) {
      raw = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
    }
  }

  if (!raw) return null;

  // Vercel дээр \\n болж хувирсан private_key-ийн мөр шилжилтийг засах
  const privateKey =
    typeof raw.private_key === "string"
      ? raw.private_key.replace(/\\n/g, "\n")
      : typeof raw.privateKey === "string"
        ? raw.privateKey.replace(/\\n/g, "\n")
        : undefined;

  return {
    projectId: String(raw.project_id ?? raw.projectId ?? ""),
    clientEmail: String(raw.client_email ?? raw.clientEmail ?? ""),
    privateKey,
  };
}

const serviceAccount = loadServiceAccount();

const app =
  getApps().length > 0
    ? getApps()[0]
    : serviceAccount && serviceAccount.privateKey
      ? initializeApp({
          credential: cert(serviceAccount),
          projectId:
            serviceAccount.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        })
      : initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);