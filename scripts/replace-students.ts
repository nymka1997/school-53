  import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp, deleteApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";

type StudentInput = { name: string; grade: string; section: string };
type ClassGroup = { grade: string; section: string; count: number };

const ROOT = process.cwd();
const SERVICE_ACCOUNT_CANDIDATES = [
  path.join(ROOT, "service-account.json"),
  path.join(ROOT, "serviceAccountKey.json"),
];
const JSON_PATH = path.join(ROOT, "firestore_students_all_grades.json");
const BATCH_LIMIT = 400;

function normalizeGrade(value: unknown): string {
  return String(value ?? "").trim();
}
function normalizeSection(value: unknown): string {
  return String(value ?? "").trim().toLocaleUpperCase("mn-MN");
}
function groupKey(grade: string, section: string): string {
  return `${grade}__${section}`;
}

async function main(): Promise<void> {
  if (process.env.CONFIRM_REPLACE_STUDENTS !== "YES") {
    throw new Error('Баталгаажуулалт дутуу. PowerShell: $env:CONFIRM_REPLACE_STUDENTS="YES"');
  }

  const serviceAccountPath = SERVICE_ACCOUNT_CANDIDATES.find((file) => fs.existsSync(file));
  if (!serviceAccountPath) {
    throw new Error("service-account.json эсвэл serviceAccountKey.json файл төслийн үндсэн хавтсанд олдсонгүй.");
  }
  if (!fs.existsSync(JSON_PATH)) {
    throw new Error("firestore_students_all_grades.json файл төслийн үндсэн хавтсанд олдсонгүй.");
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  const app = getApps().find((item) => item.name === "students-import") ??
    initializeApp({ credential: cert(serviceAccount) }, "students-import");
  const db = getFirestore(app);

  try {
    const raw: unknown = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
    if (!Array.isArray(raw) || raw.length === 0) throw new Error("JSON файл хоосон эсвэл массив биш байна.");

    const students: StudentInput[] = raw.map((item: unknown, index: number) => {
      if (typeof item !== "object" || item === null) throw new Error(`${index + 1}-р мөр буруу бүтэцтэй.`);
      const row = item as Record<string, unknown>;
      const name = String(row.name ?? "").trim();
      const grade = normalizeGrade(row.grade);
      const section = normalizeSection(row.section);
      if (!name || !grade || !section) throw new Error(`${index + 1}-р мөрөнд name, grade эсвэл section дутуу.`);
      return { name, grade, section };
    });

    const groups = new Map<string, ClassGroup>();
    for (const student of students) {
      const key = groupKey(student.grade, student.section);
      const current = groups.get(key) ?? { grade: student.grade, section: student.section, count: 0 };
      current.count += 1;
      groups.set(key, current);
    }

    console.log(`JSON шалгалт: ${students.length} сурагч, ${groups.size} давхардалгүй анги-бүлэг.`);
    console.log("Зөвхөн students collection-ийн хуучин мэдээллийг устгаж байна...");

    const studentsRef = db.collection("students");
    while (true) {
      const snapshot = await studentsRef.limit(BATCH_LIMIT).get();
      if (snapshot.empty) break;
      const batch = db.batch();
      snapshot.docs.forEach((document: QueryDocumentSnapshot) => batch.delete(document.ref));
      await batch.commit();
      console.log(`${snapshot.size} хуучин сурагчийн бичлэг устгалаа.`);
    }

    for (let start = 0; start < students.length; start += BATCH_LIMIT) {
      const batch = db.batch();
      for (const student of students.slice(start, start + BATCH_LIMIT)) {
        const ref = studentsRef.doc();
        batch.set(ref, {
          id: ref.id,
          name: student.name,
          grade: student.grade,
          section: student.section,
          status: "",
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      console.log(`Сурагч импорт: ${Math.min(start + BATCH_LIMIT, students.length)} / ${students.length}`);
    }

    // Match classes by grade + section. Create missing groups and refresh count
    // for matching groups while preserving teacher/building/room/shift fields.
    const classesRef = db.collection("classes");
    const existingClasses = await classesRef.get();
    const existingByKey = new Map<string, QueryDocumentSnapshot>();
    for (const classDoc of existingClasses.docs) {
      const data = classDoc.data();
      const grade = normalizeGrade(data.grade);
      const section = normalizeSection(data.section);
      if (grade && section && !existingByKey.has(groupKey(grade, section))) {
        existingByKey.set(groupKey(grade, section), classDoc);
      }
    }

    let created = 0;
    let countUpdated = 0;
    const groupEntries = [...groups.entries()];
    for (let start = 0; start < groupEntries.length; start += BATCH_LIMIT) {
      const batch = db.batch();
      for (const [key, group] of groupEntries.slice(start, start + BATCH_LIMIT)) {
        const existingDoc = existingByKey.get(key);
        if (existingDoc) {
          batch.set(existingDoc.ref, { count: group.count }, { merge: true });
          countUpdated += 1;
        } else {
          const ref = classesRef.doc();
          batch.set(ref, {
            building: "",
            classRoom: "",
            count: group.count,
            createdAt: FieldValue.serverTimestamp(),
            grade: group.grade,
            section: group.section,
            shift: "",
            teacher: "",
          });
          created += 1;
        }
      }
      await batch.commit();
    }

    console.log("\nАМЖИЛТТАЙ ДУУСЛАА.");
    console.log(`Шинээр импортолсон сурагч: ${students.length}`);
    console.log(`JSON-оос ялгасан нийт давхардалгүй бүлэг: ${groups.size}`);
    console.log(`Шинээр үүсгэсэн анги-бүлэг: ${created}`);
    console.log(`Байгаа ангийн count шинэчилсэн: ${countUpdated}`);
    console.log("classes-ийн багш, байр, өрөө, ээлжийн бусад мэдээллийг хадгалсан.");
    console.log("Анхаар: Цаашид сурагч нэмэх/устгах үед count шинэчлэх логикийг веб аппын API-д мөн нэмэх шаардлагатай.");
  } finally {
    await deleteApp(app);
  }
}

main().catch((error: unknown) => {
  console.error("Импорт амжилтгүй:", error);
  process.exitCode = 1;
});
