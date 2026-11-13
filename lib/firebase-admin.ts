import "server-only";

import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadServiceAccount(): ServiceAccount | null {
  // 1. Vercel дээрх Environment Variable-аас унших
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) as ServiceAccount;
  }

  // 2. Локал компьютер дээр service-account.json файл байвал унших
  const serviceAccountPath = path.join(process.cwd(), "service-account.json");
  if (existsSync(serviceAccountPath)) {
    return JSON.parse(readFileSync(serviceAccountPath, "utf8")) as ServiceAccount;
  }

  return null;
}

const serviceAccount = loadServiceAccount();

const app =
  getApps().length > 0
    ? getApps()[0]
    : serviceAccount
      ? initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        })
      : initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);