import "server-only";

import { cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function normalizePrivateKey(key?: string): string | undefined {
  if (!key) return undefined;
  return key
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");
}

function loadServiceAccount(): ServiceAccount | null {
  // 1. Тусдаа 3 хувьсагчаар өгсөн бол (Vercel дээр хамгийн найдвартай арга)
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID.trim(),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
      privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    };
  }

  // 2. Бүтэн JSON хэлбэрээр өгсөн бол
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const raw = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      return {
        projectId: String(raw.project_id ?? raw.projectId ?? "").trim(),
        clientEmail: String(raw.client_email ?? raw.clientEmail ?? "").trim(),
        privateKey: normalizePrivateKey(raw.private_key ?? raw.privateKey),
      };
    } catch {
      console.error("FIREBASE_SERVICE_ACCOUNT_KEY JSON parse error");
    }
  }

  // 3. Локал компьютер дээр service-account.json файл байвал
  const serviceAccountPath = path.join(process.cwd(), "service-account.json");
  if (existsSync(serviceAccountPath)) {
    const raw = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
    return {
      projectId: String(raw.project_id ?? "").trim(),
      clientEmail: String(raw.client_email ?? "").trim(),
      privateKey: normalizePrivateKey(raw.private_key),
    };
  }

  return null;
}

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccount = loadServiceAccount();
  if (serviceAccount && serviceAccount.privateKey) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  return initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

// Зөвхөн API дуудагдах үед ажиллана (Build үед алдаа зааж унахгүй)
export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    const auth = getAuth(getAdminApp());
    const value = auth[prop as keyof Auth];
    return typeof value === "function" ? value.bind(auth) : value;
  },
});

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    const db = getFirestore(getAdminApp());
    const value = db[prop as keyof Firestore];
    return typeof value === "function" ? value.bind(db) : value;
  },
});