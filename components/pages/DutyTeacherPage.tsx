
"use client";

import { useEffect, useState } from "react";
import {
  ClipboardCheck,
  Plus,
  Trash2,
  Building2,
  Users,
} from "lucide-react";

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import styles from "./DutyTeacherPage.module.css";

// Багшийн мэдээлэл
type Teacher = {
  id: string;       // Firestore Document ID
  uid: string;      // Firebase Auth UID
  name: string;
  subject: string;
};

// Жижүүрийн хуваарийн мэдээлэл
type Assignment = {
  id: string;
  date: string;
  building: string;
  shift: string;
  teacher1Id: string;
  teacher1Name: string;
  teacher1Subject: string;
  teacher2Id: string;
  teacher2Name: string;
  teacher2Subject: string;
  createdAt?: unknown;
};

const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export default function DutyTeacherPage() {
  const [date, setDate] = useState(today());
  const [building, setBuilding] = useState("А байр");
  const [shift, setShift] = useState("Өглөө");

  const [subject1, setSubject1] = useState("");
  const [subject2, setSubject2] = useState("");

  // Энд Firebase Auth UID хадгалагдана
  const [teacher1, setTeacher1] = useState("");
  const [teacher2, setTeacher2] = useState("");

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [items, setItems] = useState<Assignment[]>([]);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Судлагдахуунууд
  const subjects = [
    ...new Set(
      teachers.map((t) => t.subject).filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, "mn"));

  // Судлагдахуунаар багш шүүх
  const filteredTeachers1 = teachers.filter(
    (t) => t.subject === subject1
  );

  const filteredTeachers2 = teachers.filter(
    (t) => t.subject === subject2
  );

  // =====================================
  // БАГШ БОЛОН ЖИЖҮҮРИЙН БҮРТГЭЛ ТАТАХ
  // =====================================

  useEffect(() => {
    // Багш нар татах
    const unsubscribeTeachers = onSnapshot(
      collection(db, "teachers"),
      (snapshot) => {
        const data = snapshot.docs
          .map((d) => ({
            id: d.id,
            uid: d.data().uid || "",
            name: d.data().name || d.data().fullName || "",
            subject: d.data().subject || "",
          }))
          .filter((t) => t.name && t.uid);

        setTeachers(data);
      },
      (error) => {
        console.error("Багш татах алдаа:", error);
        setMessage("Багш нарын мэдээлэл татахад алдаа гарлаа");
      }
    );

    // Жижүүрийн бүртгэл татах
    const assignmentQuery = query(
      collection(db, "dutyAssignments"),
      orderBy("date", "desc")
    );

    const unsubscribeAssignments = onSnapshot(
      assignmentQuery,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Assignment[];

        setItems(data);
        setLoading(false);
      },
      (error) => {
        console.error("Бүртгэл татах алдаа:", error);
        setMessage("Жижүүрийн бүртгэл татахад алдаа гарлаа");
        setLoading(false);
      }
    );

    return () => {
      unsubscribeTeachers();
      unsubscribeAssignments();
    };
  }, []);

  // =====================================
  // ЖИЖҮҮРИЙН ХУВААРЬ ХАДГАЛАХ
  // =====================================

  async function save() {
    if (!date || !teacher1 || !teacher2) {
      setMessage("Огноо болон хоёр багшийг сонгоно уу");
      return;
    }

    if (teacher1 === teacher2) {
      setMessage("Нэг багшийг хоёр удаа сонгох боломжгүй");
      return;
    }

    if (!subject1 || !subject2) {
      setMessage("Хоёр багшийн судлагдахууныг сонгоно уу");
      return;
    }

    // Firebase Auth UID-аар багш хайна
    const t1 = teachers.find((t) => t.uid === teacher1);
    const t2 = teachers.find((t) => t.uid === teacher2);

    if (!t1 || !t2) {
      setMessage("Багшийн мэдээлэл олдсонгүй");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      // Огноо + байр + ээлжийн давтагдашгүй ID
      const key = `${date}_${building}_${shift}`;

      const batch = writeBatch(db);

      const dutyRef = doc(db, "dutyAssignments", key);

      // Хуучин документыг шинэчилнэ
      // Ижил ID-тай тул давхар бүртгэл үүсэхгүй
      batch.set(dutyRef, {
        date,
        building,
        shift,

        // Firebase Auth UID хадгална
        teacher1Id: t1.uid,
        teacher1Name: t1.name,
        teacher1Subject: t1.subject,

        teacher2Id: t2.uid,
        teacher2Name: t2.name,
        teacher2Subject: t2.subject,

        createdAt: serverTimestamp(),
      });

      await batch.commit();

      setTeacher1("");
      setTeacher2("");
      setSubject1("");
      setSubject2("");

      setMessage("Жижүүрийн хуваарь шинэчлэгдэн хадгалагдлаа");
    } catch (error) {
      console.error("Хадгалах алдаа:", error);
      setMessage("Хадгалахад алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  }

  // =====================================
  // БҮРТГЭЛ УСТГАХ
  // =====================================

  async function removeItem(id: string) {
    if (!confirm("Энэ жижүүрийн бүртгэлийг устгах уу?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "dutyAssignments", id));
      setMessage("Бүртгэл устгагдлаа");
    } catch (error) {
      console.error("Устгах алдаа:", error);
      setMessage("Устгахад алдаа гарлаа");
    }
  }

  // =====================================
  // ДЭЛГЭЦ
  // =====================================

  return (
    <div className={styles.page}>
      {/* БҮРТГЭЛ НЭМЭХ */}
      <section className={styles.panel}>
        <div className={styles.heading}>
          <span className={styles.icon}>
            <ClipboardCheck size={22} />
          </span>

          <div>
            <h2>Жижүүр багшийн бүртгэл</h2>
            <p>
              Байр, ээлж болон хариуцах багш нарыг бүртгэнэ
            </p>
          </div>
        </div>

        <div className={styles.form}>
          {/* ОГНОО */}
          <label>
            Огноо
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={saving}
            />
          </label>

          {/* БАЙР */}
          <label>
            <Building2 size={15} /> Байр
            <select
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              disabled={saving}
            >
              <option value="А байр">А байр</option>
              <option value="Б байр">Б байр</option>
            </select>
          </label>

          {/* ЭЭЛЖ */}
          <label>
            Ээлж
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              disabled={saving}
            >
              <option value="Өглөө">Өглөө</option>
              <option value="Өдөр">Өдөр</option>
              <option value="Орой">Орой</option>
            </select>
          </label>
        </div>

        {/* БАГШ СОНГОХ */}
        <div className={styles.form}>
          {/* 1-Р БАГШ */}
          <div className={styles.teacherGroup}>
            <label>
              1-р багшийн судлагдахуун

              <select
                value={subject1}
                onChange={(e) => {
                  setSubject1(e.target.value);
                  setTeacher1("");
                }}
                disabled={saving}
              >
                <option value="">
                  Судлагдахуун сонгох
                </option>

                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <Users size={15} /> 1-р жижүүр багш

              <select
                value={teacher1}
                onChange={(e) => setTeacher1(e.target.value)}
                disabled={!subject1 || saving}
              >
                <option value="">Багш сонгох</option>

                {filteredTeachers1.map((t) => (
                  <option key={t.id} value={t.uid}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* 2-Р БАГШ */}
          <div className={styles.teacherGroup}>
            <label>
              2-р багшийн судлагдахуун

              <select
                value={subject2}
                onChange={(e) => {
                  setSubject2(e.target.value);
                  setTeacher2("");
                }}
                disabled={saving}
              >
                <option value="">
                  Судлагдахуун сонгох
                </option>

                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <Users size={15} /> 2-р жижүүр багш

              <select
                value={teacher2}
                onChange={(e) => setTeacher2(e.target.value)}
                disabled={!subject2 || saving}
              >
                <option value="">Багш сонгох</option>

                {filteredTeachers2
                  .filter((t) => t.uid !== teacher1)
                  .map((t) => (
                    <option key={t.id} value={t.uid}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </div>

        {/* ХАДГАЛАХ */}
        <button
          className={styles.primary}
          onClick={save}
          disabled={saving}
        >
          <Plus size={16} />
          {saving ? "Хадгалж байна..." : "Бүртгэл нэмэх"}
        </button>

        {message && (
          <p className={styles.message}>{message}</p>
        )}
      </section>

      {/* БҮРТГЭЛИЙН ЖАГСААЛТ */}
      <section className={styles.panel}>
        <div className={styles.tableHead}>
          <h2>Жижүүрийн бүртгэл</h2>
          <span>{items.length} бүртгэл</span>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Огноо</th>
                <th>Байр</th>
                <th>Ээлж</th>
                <th>1-р багш</th>
                <th>2-р багш</th>
                <th>Үйлдэл</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>Уншиж байна...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    Бүртгэл байхгүй байна
                  </td>
                </tr>
              ) : (
                items.map((x) => (
                  <tr key={x.id}>
                    <td>{x.date}</td>
                    <td>{x.building}</td>
                    <td>{x.shift}</td>

                    <td>
                      <strong>{x.teacher1Name}</strong>
                    </td>

                    <td>
                      <strong>{x.teacher2Name}</strong>
                    </td>

                    <td>
                      <button
                        className={styles.delete}
                        onClick={() => removeItem(x.id)}
                        aria-label="Устгах"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className={styles.note}>
          Firebase Firestore-той холбогдсон.
          Бүртгэлүүд автоматаар шинэчлэгдэнэ.
        </p>
      </section>
    </div>
  );
}
