
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const ADMIN_UID = "LbBqMciKATfXslfjPcVhLRRj0hD3";

type Notice = {
  id: string;
  title: string;
  body: string;
  date: string;
  category?: string;
  priority?: string;
  targetType?: string;
  targetTeacherIds?: string[];
  status?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: any;
};

type Teacher = {
  id: string;
  uid: string;
  name: string;
};

const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
  }).format(new Date());

const emptyForm = {
  title: "",
  body: "",
  category: "Ерөнхий",
  priority: "normal",
  targetType: "all",
  targetTeacherIds: [] as string[],
  status: "published",
  startDate: today(),
  endDate: "",
};

export default function AnnouncementsPage() {
  const user = auth.currentUser;
  const isAdmin = user?.uid === ADMIN_UID;

  const [notices, setNotices] = useState<Notice[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [readCounts, setReadCounts] = useState<Record<string, number>>({});
  const [readByMe, setReadByMe] = useState<string[]>([]);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedNotice, setSelectedNotice] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3000);
  };

  // Зар, мэдээ бодит хугацаанд татах
  useEffect(() => {
    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Notice[];

        setNotices(items);
      },
      (error) => {
        console.error("Зар татах алдаа:", error);
        notify("Зар татаж чадсангүй");
      }
    );
  }, []);

  // Багш нарын жагсаалт
  useEffect(() => {
    if (!isAdmin) return;

    return onSnapshot(
      collection(db, "teachers"),
      (snapshot) => {
        const list = snapshot.docs
          .map((item) => {
            const data = item.data();

            return {
              id: item.id,
              uid: String(data.uid || item.id),
              name: String(data.name || ""),
            };
          })
          .filter((item) => item.name && item.uid);

        setTeachers(list);
      },
      (error) => {
        console.error("Багш татах алдаа:", error);
      }
    );
  }, [isAdmin]);

  // Багшийн өөрийн уншсан зарууд
  useEffect(() => {
    if (isAdmin || !user) return;

    return onSnapshot(
      collection(db, "users", user.uid, "announcementReads"),
      (snapshot) => {
        setReadByMe(snapshot.docs.map((item) => item.id));
      },
      (error) => {
        console.error("Уншсан зар татах алдаа:", error);
      }
    );
  }, [isAdmin, user]);

  // Зар бүрийн уншсан багшийн тоо
  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribers = notices.map((notice) =>
      onSnapshot(
        collection(db, "announcements", notice.id, "reads"),
        (snapshot) => {
          setReadCounts((prev) => ({
            ...prev,
            [notice.id]: snapshot.size,
          }));
        },
        (error) => {
          console.error("Уншсан төлөв татах алдаа:", error);
        }
      )
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [isAdmin, notices]);

  const visibleNotices = useMemo(() => {
    const currentDate = today();

    return notices.filter((notice) => {
      const status = notice.status || "published";
      const targetType = notice.targetType || "all";

      if (!isAdmin) {
        if (status !== "published") return false;

        if (notice.startDate && notice.startDate > currentDate) {
          return false;
        }

        if (notice.endDate && notice.endDate < currentDate) {
          return false;
        }

        if (
          targetType === "selected" &&
          !notice.targetTeacherIds?.includes(user?.uid || "")
        ) {
          return false;
        }
      }

      if (filter !== "all" && status !== filter) return false;

      const searchText = `${notice.title} ${notice.body}`.toLowerCase();

      return searchText.includes(search.toLowerCase());
    });
  }, [notices, filter, search, isAdmin, user]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function editNotice(notice: Notice) {
    setEditingId(notice.id);

    setForm({
      title: notice.title || "",
      body: notice.body || "",
      category: notice.category || "Ерөнхий",
      priority: notice.priority || "normal",
      targetType: notice.targetType || "all",
      targetTeacherIds: notice.targetTeacherIds || [],
      status: notice.status || "published",
      startDate: notice.startDate || notice.date || today(),
      endDate: notice.endDate || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveNotice(status: "draft" | "published") {
    if (!isAdmin) {
      notify("Зөвхөн админ зар удирдах эрхтэй");
      return;
    }

    if (!form.title.trim() || !form.body.trim()) {
      notify("Гарчиг болон мэдээллээ бөглөнө үү");
      return;
    }

    if (
      form.targetType === "selected" &&
      form.targetTeacherIds.length === 0
    ) {
      notify("Хүргэх багшаа сонгоно уу");
      return;
    }

    if (
      form.endDate &&
      form.startDate &&
      form.endDate < form.startDate
    ) {
      notify("Дуусах огноо эхлэх огнооноос өмнө байж болохгүй");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        date: today(),
        category: form.category,
        priority: form.priority,
        targetType: form.targetType,
        targetTeacherIds:
          form.targetType === "selected"
            ? form.targetTeacherIds
            : [],
        status,
        startDate: form.startDate,
        endDate: form.endDate,
        createdBy: user?.uid || "",
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(
          doc(db, "announcements", editingId),
          payload
        );
      } else {
        await addDoc(collection(db, "announcements"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
      notify(status === "draft" ? "Ноорог хадгалагдлаа" : "Зар нийтлэгдлээ");
    } catch (error) {
      console.error("Зар хадгалах алдаа:", error);
      notify("Зар хадгалж чадсангүй");
    } finally {
      setSaving(false);
    }
  }

  async function removeNotice(id: string) {
    if (!isAdmin) return;
    if (!window.confirm("Энэ зарыг устгах уу?")) return;

    try {
      await deleteDoc(doc(db, "announcements", id));
      notify("Зар устгагдлаа");
    } catch (error) {
      console.error(error);
      notify("Зар устгаж чадсангүй");
    }
  }

  async function markAsRead(noticeId: string) {
    if (!user || isAdmin) return;

    try {
      await setDoc(
        doc(db, "announcements", noticeId, "reads", user.uid),
        {
          teacherUid: user.uid,
          readAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "users", user.uid, "announcementReads", noticeId),
        {
          announcementId: noticeId,
          readAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Уншсан төлөв хадгалах алдаа:", error);
      notify("Уншсан төлөв хадгалж чадсангүй");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #d7e1ed",
    borderRadius: 10,
    fontSize: 14,
    color: "#17324d",
    background: "#fff",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    fontSize: 13,
    fontWeight: 650,
    color: "#40536b",
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: isAdmin ? "minmax(0, 1.2fr) minmax(340px, .8fr)" : "1fr", gap: 22, alignItems: "start" }}>
      <section style={{ background: "#fff", border: "1px solid #e1eaf3", borderRadius: 18, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, color: "#17324d" }}>Зар, мэдээ</h2>
            <p style={{ color: "#71839a", fontSize: 13, margin: "5px 0 0" }}>
              {visibleNotices.length} мэдээ
            </p>
          </div>
          <input
            style={{ ...inputStyle, maxWidth: 240 }}
            placeholder="Зар хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isAdmin && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            {[
              ["all", "Бүгд"],
              ["published", "Нийтэлсэн"],
              ["draft", "Ноорог"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                style={{
                  padding: "9px 14px",
                  borderRadius: 9,
                  border: "1px solid #dce6f1",
                  background: filter === value ? "#eaf3ff" : "#fff",
                  color: "#245b91",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          {visibleNotices.map((notice) => {
            const isRead = readByMe.includes(notice.id);
            const isOpen = selectedNotice === notice.id;

            return (
              <article key={notice.id} style={{ border: "1px solid #e3ebf4", borderRadius: 14, padding: 17 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
                      <span style={{ background: "#edf4fc", color: "#245b91", borderRadius: 20, padding: "4px 9px", fontSize: 11 }}>
                        {notice.category || "Ерөнхий"}
                      </span>
                      {notice.priority === "high" && (
                        <span style={{ background: "#fff0ed", color: "#c24135", borderRadius: 20, padding: "4px 9px", fontSize: 11 }}>
                          Яаралтай
                        </span>
                      )}
                      {isAdmin && (
                        <span style={{ background: notice.status === "draft" ? "#fff7e8" : "#e9f8ef", color: notice.status === "draft" ? "#9a6700" : "#187343", borderRadius: 20, padding: "4px 9px", fontSize: 11 }}>
                          {notice.status === "draft" ? "Ноорог" : "Нийтэлсэн"}
                        </span>
                      )}
                    </div>

                    <h3 style={{ margin: "0 0 7px", color: "#17324d" }}>{notice.title}</h3>
                    <p style={{ margin: 0, color: "#71839a", fontSize: 12 }}>
                      {notice.date || ""}
                    </p>
                  </div>

                  {!isAdmin && (
                    <span style={{ color: isRead ? "#16834a" : "#71839a", fontSize: 12, whiteSpace: "nowrap" }}>
                      {isRead ? "✓ Уншсан" : "Уншаагүй"}
                    </span>
                  )}
                </div>

                <p style={{ color: "#52677f", lineHeight: 1.65, whiteSpace: "pre-wrap", margin: "13px 0" }}>
                  {isOpen ? notice.body : `${notice.body.slice(0, 180)}${notice.body.length > 180 ? "..." : ""}`}
                </p>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {notice.body.length > 180 && (
                    <button onClick={() => setSelectedNotice(isOpen ? null : notice.id)} style={{ border: 0, background: "transparent", color: "#1769b0", cursor: "pointer", padding: 0 }}>
                      {isOpen ? "Хураах" : "Дэлгэрэнгүй"}
                    </button>
                  )}

                  {!isAdmin && !isRead && (
                    <button onClick={() => markAsRead(notice.id)} style={{ border: 0, background: "#eaf3ff", color: "#1769b0", padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}>
                      Уншсан гэж тэмдэглэх
                    </button>
                  )}

                  {isAdmin && (
                    <>
                      <span style={{ color: "#71839a", fontSize: 12 }}>
                        Уншсан: {readCounts[notice.id] || 0} багш
                      </span>
                      <button onClick={() => editNotice(notice)} style={{ marginLeft: "auto", border: "1px solid #dce6f1", background: "#fff", padding: "8px 11px", borderRadius: 8, cursor: "pointer" }}>
                        Засах
                      </button>
                      <button onClick={() => removeNotice(notice.id)} style={{ border: "1px solid #f1d7d7", background: "#fff", color: "#bd3838", padding: "8px 11px", borderRadius: 8, cursor: "pointer" }}>
                        Устгах
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}

          {visibleNotices.length === 0 && (
            <p style={{ color: "#71839a", textAlign: "center", padding: 30 }}>
              Одоогоор харагдах зар байхгүй байна.
            </p>
          )}
        </div>
      </section>

      {isAdmin && (
        <section style={{ background: "#fff", border: "1px solid #e1eaf3", borderRadius: 18, padding: 22 }}>
          <h2 style={{ margin: "0 0 18px", color: "#17324d" }}>
            {editingId ? "Зар засах" : "Шинэ зар үүсгэх"}
          </h2>

          <div style={{ display: "grid", gap: 15 }}>
            <label style={labelStyle}>
              Зарын гарчиг
              <input
                style={inputStyle}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Жишээ: Багш нарын хурал"
              />
            </label>

            <label style={labelStyle}>
              Дэлгэрэнгүй мэдээлэл
              <textarea
                style={{ ...inputStyle, minHeight: 150, resize: "vertical" }}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Зарын дэлгэрэнгүй мэдээллээ бичнэ үү..."
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={labelStyle}>
                Ангилал
                <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option>Ерөнхий</option>
                  <option>Хурал</option>
                  <option>Сургалт</option>
                  <option>Үйл ажиллагаа</option>
                  <option>Мэдэгдэл</option>
                </select>
              </label>

              <label style={labelStyle}>
                Чухал байдал
                <select style={inputStyle} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="normal">Энгийн</option>
                  <option value="high">Яаралтай</option>
                </select>
              </label>
            </div>

            <label style={labelStyle}>
              Хэнд хүргэх вэ?
              <select style={inputStyle} value={form.targetType} onChange={(e) => setForm({ ...form, targetType: e.target.value })}>
                <option value="all">Бүх багшид</option>
                <option value="selected">Сонгосон багшид</option>
              </select>
            </label>

            {form.targetType === "selected" && (
              <div style={{ border: "1px solid #dce6f1", borderRadius: 10, padding: 12, maxHeight: 190, overflowY: "auto" }}>
                {teachers.map((teacher) => (
                  <label key={teacher.uid} style={{ display: "flex", gap: 9, padding: "7px 0", color: "#40536b", fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={form.targetTeacherIds.includes(teacher.uid)}
                      onChange={(e) => {
                        const ids = e.target.checked
                          ? [...form.targetTeacherIds, teacher.uid]
                          : form.targetTeacherIds.filter((id) => id !== teacher.uid);

                        setForm({ ...form, targetTeacherIds: ids });
                      }}
                    />
                    {teacher.name}
                  </label>
                ))}
                {teachers.length === 0 && <p>Багшийн бүртгэл олдсонгүй.</p>}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={labelStyle}>
                Эхлэх огноо
                <input type="date" style={inputStyle} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </label>

              <label style={labelStyle}>
                Дуусах огноо
                <input type="date" style={inputStyle} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </label>
            </div>

            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              <button disabled={saving} onClick={() => saveNotice("draft")} style={{ flex: 1, padding: 12, border: "1px solid #dce6f1", borderRadius: 10, background: "#fff", color: "#245b91", cursor: "pointer" }}>
                Ноорог хадгалах
              </button>

              <button disabled={saving} onClick={() => saveNotice("published")} style={{ flex: 1, padding: 12, border: 0, borderRadius: 10, background: "#176fd0", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                {saving ? "Хадгалж байна..." : editingId ? "Өөрчлөлт хадгалах" : "Нийтлэх"}
              </button>
            </div>

            {editingId && (
              <button onClick={resetForm} style={{ padding: 10, border: 0, background: "transparent", color: "#71839a", cursor: "pointer" }}>
                Засвар цуцлах
              </button>
            )}
          </div>
        </section>
      )}

      {message && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "#17324d", color: "#fff", padding: "12px 20px", borderRadius: 10, boxShadow: "0 8px 24px #0002" }}>
          {message}
        </div>
      )}
    </div>
  );
}
