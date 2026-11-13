import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import path from "node:path";

const serviceAccountPath = path.join(
  process.cwd(),
  "service-account.json"
);

const serviceAccount = JSON.parse(
  readFileSync(serviceAccountPath, "utf8")
);

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);