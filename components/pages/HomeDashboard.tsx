"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import {
  GraduationCap,
  UserRound,
  BookOpen,
  CalendarCheck,
  Megaphone,
  BarChart3,
} from "lucide-react";
import { db } from "@/lib/firebase";

type Notice = {
  id: string;
  title: string;
  date: string;
  body: string;
};

type AttendanceRow = {
  grade: string;
  status: string;
};

type Props = {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  notices: Notice[];
  onGoToReports: () => void;
};

// Санах ойн кэш (Үндсэн хуудас руу буцаж ороход Firebase-аас дахин уншихгүй)
let cachedHomeAttendance: {
  date: string;
  isToday: boolean;
  rows: AttendanceRow[];
} | null = null;

function getToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeGrade(value: unknown) {
  return String(value ?? "").match(/\d+/)?.[0] ?? "";
}

export default function HomeDashboard({
  totalStudents,
  totalTeachers,
  totalClasses,
  notices,
  onGoToReports,
}: Props) {
  const today = getToday();

  const [attendanceDate, setAttendanceDate] = useState(today);
  const [isTodayData, setIsTodayData] = useState(true);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadLatestSchoolAttendance() {
      // Кэш байвал шууд ашиглана (0 Firebase read)
      if (cachedHomeAttendance) {
        setAttendanceDate(cachedHomeAttendance.date);
        setIsTodayData(cachedHomeAttendance.isToday);
        setAttendanceRows(cachedHomeAttendance.rows);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Зөвхөн 1 удаагийн хүсэлтээр хамгийн сүүлийн бүртгэлүүдийг татна
        const q = query(
          collection(db, "attendance"),
          orderBy("date", "desc"),
          limit(50)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          cachedHomeAttendance = { date: today, isToday: true, rows: [] };
          if (active) {
            setAttendanceRows([]);
            setLoading(false);
          }
          return;
        }

        const dates = snap.docs
          .map((d) => String(d.data().date ?? ""))
          .filter(Boolean);

        const targetDate = dates.includes(today) ? today : dates[0];
        const rows: AttendanceRow[] = [];

        snap.docs.forEach((docItem) => {
          const data = docItem.data();
          if (String(data.date ?? "") !== targetDate) return;

          const grade = normalizeGrade(data.grade);
          const students = Array.isArray(data.students) ? data.students : [];

          students.forEach((st: { status?: unknown }) => {
            rows.push({
              grade,
              status: String(st.status ?? ""),
            });
          });
        });

        cachedHomeAttendance = {
          date: targetDate,
          isToday: targetDate === today,
          rows,
        };

        if (active) {
          setAttendanceDate(targetDate);
          setIsTodayData(targetDate === today);
          setAttendanceRows(rows);
        }
      } catch (err) {
        console.error("Нүүр хуудасны ирц татах алдаа:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadLatestSchoolAttendance();
    return () => {
      active = false;
    };
  }, [today]);

  // Нийт ирцийн статистик
  const summary = useMemo(() => {
    const total = attendanceRows.length;
    const present = attendanceRows.filter((r) => r.status === "Ирсэн").length;
    const sick = attendanceRows.filter((r) => r.status === "Өвчтэй").length;
    const leave = attendanceRows.filter((r) => r.status === "Чөлөөтэй").length;
    const absent = attendanceRows.filter((r) => r.status === "Тасалсан").length;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;

    return { total, present, sick, leave, absent, pct };
  }, [attendanceRows]);

  // Анги тус бүрийн ирцийн хувь (Баганан графикт)
  const gradeBars = useMemo(() => {
    const map = new Map<string, { grade: string; total: number; present: number }>();

    attendanceRows.forEach((r) => {
      const g = r.grade || "?";
      if (!map.has(g)) {
        map.set(g, { grade: g, total: 0, present: 0 });
      }
      const item = map.get(g)!;
      item.total += 1;
      if (r.status === "Ирсэн") item.present += 1;
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        pct: item.total > 0 ? Math.round((item.present / item.total) * 100) : 0,
      }))
      .sort((a, b) => Number(a.grade) - Number(b.grade));
  }, [attendanceRows]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* 1. Дээд талын 4 ерөнхий статистик карт */}
      <section
        className="stats"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
        }}
      >
        <div
          className="stat"
          style={{
            padding: "18px 20px",
            boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div
            className="stat-icon"
            style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}
          >
            <GraduationCap size={22} />
          </div>
          <div>
            <span>Нийт сурагчид</span>
            <strong style={{ fontSize: 22 }}>{totalStudents}</strong>
          </div>
        </div>

        <div
          className="stat"
          style={{
            padding: "18px 20px",
            boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div
            className="stat-icon"
            style={{ backgroundColor: "#f0fdf4", color: "#16a34a" }}
          >
            <UserRound size={22} />
          </div>
          <div>
            <span>Нийт багш нар</span>
            <strong style={{ fontSize: 22 }}>{totalTeachers}</strong>
          </div>
        </div>

        <div
          className="stat"
          style={{
            padding: "18px 20px",
            boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div
            className="stat-icon"
            style={{ backgroundColor: "#fefce8", color: "#ca8a04" }}
          >
            <BookOpen size={22} />
          </div>
          <div>
            <span>Анги, бүлэг</span>
            <strong style={{ fontSize: 22 }}>{totalClasses}</strong>
          </div>
        </div>

        <div
          className="stat"
          onClick={onGoToReports}
          style={{
            padding: "18px 20px",
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div
            className="stat-icon"
            style={{ backgroundColor: "#ecfdf5", color: "#059669" }}
          >
            <CalendarCheck size={22} />
          </div>
          <div>
            <span>
              {isTodayData ? "Өнөөдрийн ирц" : `Сүүлийн ирц (${attendanceDate.slice(5)})`}
            </span>
            <strong style={{ fontSize: 22 }}>
              {loading ? "..." : `${summary.pct}%`}
            </strong>
          </div>
        </div>
      </section>

      {/* 2. Сүүдэр оруулсан босоо баганан график */}
      <section
        className="panel"
        style={{
          padding: "22px 24px",
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BarChart3 size={19} color="#2563eb" />
              <h2 style={{ margin: 0, fontSize: 17 }}>
                {isTodayData
                  ? `Өнөөдрийн сургуулийн ирц (${attendanceDate})`
                  : `Сүүлд бүртгэгдсэн сургуулийн ирц (${attendanceDate})`}
              </h2>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
              {isTodayData
                ? "Анги тус бүрийн өнөөдрийн ирцийн гүйцэтгэл"
                : "Өнөөдөр ирц хараахан бүртгэгдээгүй тул сүүлийн өдрийн ирцийг харуулж байна"}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 999,
                backgroundColor: "#dcfce7",
                color: "#15803d",
              }}
            >
              Ирсэн: {summary.present}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 999,
                backgroundColor: "#dbeafe",
                color: "#1d4ed8",
              }}
            >
              Өвчтэй: {summary.sick}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 999,
                backgroundColor: "#fef3c7",
                color: "#b45309",
              }}
            >
              Чөлөөтэй: {summary.leave}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 999,
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
              }}
            >
              Тасалсан: {summary.absent}
            </span>
            <button
              type="button"
              className="secondary"
              onClick={onGoToReports}
              style={{ fontSize: 13 }}
            >
              Дэлгэрэнгүй тайлан →
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ padding: "30px 0", textAlign: "center", color: "#64748b" }}>
            Ирцийн мэдээлэл ачаалж байна...
          </p>
        ) : gradeBars.length === 0 ? (
          <p style={{ padding: "30px 0", textAlign: "center", color: "#64748b" }}>
            Одоогоор бүртгэгдсэн ирцийн мэдээлэл алга байна.
          </p>
        ) : (
          <div style={{ overflowX: "auto", paddingBottom: 6 }}>
            <div
              style={{
                minWidth: Math.max(gradeBars.length * 76, 480),
              }}
            >
              {/* Босоо багануудын талбар */}
              <div
                style={{
                  height: 230,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent:
                    gradeBars.length <= 8 ? "space-around" : "flex-start",
                  gap: 18,
                  padding: "28px 18px 0",
                  borderBottom: "2px solid #e2e8f0",
                  backgroundImage:
                    "linear-gradient(to top, #f1f5f9 1px, transparent 1px)",
                  backgroundSize: "100% 57px",
                }}
              >
                {gradeBars.map((bar) => {
                  // Ирцийн хувиас хамаарч баганын өнгө болон сүүдэр өөрчлөгдөнө
                  const isHigh = bar.pct >= 90;
                  const isMedium = bar.pct >= 75 && bar.pct < 90;

                  const gradient = isHigh
                    ? "linear-gradient(180deg, #34d399 0%, #059669 100%)"
                    : isMedium
                    ? "linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)"
                    : "linear-gradient(180deg, #fbbf24 0%, #d97706 100%)";

                  const shadow = isHigh
                    ? "0 8px 18px -3px rgba(16, 185, 129, 0.42)"
                    : isMedium
                    ? "0 8px 18px -3px rgba(37, 99, 235, 0.38)"
                    : "0 8px 18px -3px rgba(245, 158, 11, 0.4)";

                  return (
                    <div
                      key={bar.grade}
                      onClick={onGoToReports}
                      title={`${bar.grade}-р анги: ${bar.present}/${bar.total} сурагч ирсэн (${bar.pct}%)`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        flex: "1 1 56px",
                        maxWidth: 74,
                        height: "100%",
                        justifyContent: "flex-end",
                        cursor: "pointer",
                      }}
                    >
                      {/* Дээрх хувь ба тоо */}
                      <div
                        style={{
                          textAlign: "center",
                          marginBottom: 8,
                          lineHeight: 1.25,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#1e293b",
                          }}
                        >
                          {bar.pct}%
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {bar.present}/{bar.total}
                        </div>
                      </div>

                      {/* Сүүдэртэй босоо багана */}
                      <div
                        style={{
                          width: 40,
                          height: `${Math.max(bar.pct, 6)}%`,
                          background: gradient,
                          borderRadius: "10px 10px 0 0",
                          boxShadow: shadow,
                          transition: "height 0.4s ease, transform 0.2s ease",
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Доод ангийн дугаарууд */}
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    gradeBars.length <= 8 ? "space-around" : "flex-start",
                  gap: 18,
                  padding: "10px 18px 0",
                }}
              >
                {gradeBars.map((bar) => (
                  <div
                    key={bar.grade}
                    style={{
                      flex: "1 1 56px",
                      maxWidth: 74,
                      textAlign: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#334155",
                    }}
                  >
                    {bar.grade}-р анги
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. Сургуулийн зар, мэдээ */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Сургуулийн зар, мэдээ</h2>
            <div className="panel-sub">Админаас оруулсан мэдээлэл</div>
          </div>

          <span className="date-chip">Нийт {notices.length} зар</span>
        </div>

        {notices.length === 0 ? (
          <div
            style={{
              padding: "45px 20px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            <Megaphone
              size={38}
              style={{ margin: "0 auto 12px", opacity: 0.5 }}
            />
            <h3>Одоогоор зар, мэдээ байхгүй байна</h3>
            <p style={{ fontSize: 13 }}>
              Админ шинэ зар оруулахад энд харагдана.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {notices.map((notice) => (
              <article
                key={notice.id}
                style={{
                  display: "flex",
                  gap: 16,
                  padding: 20,
                  border: "1px solid #dbe5f1",
                  borderRadius: 12,
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    minWidth: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    background: "#eaf2ff",
                    color: "#2563eb",
                  }}
                >
                  <Megaphone size={21} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{
                      margin: "0 0 7px",
                      fontSize: 17,
                      color: "#174574",
                    }}
                  >
                    {notice.title}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      color: "#475569",
                      fontSize: 14,
                      lineHeight: 1.7,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {notice.body}
                  </p>

                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 12,
                      color: "#94a3b8",
                    }}
                  >
                    {notice.date}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}