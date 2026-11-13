"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  Users,
  CheckCircle2,
  Clock3,
  CircleX,
  HeartPulse,
  Download,
  ChevronLeft,
  ChevronRight,
  Calendar,
  BarChart3,
  Search,
  X,
} from "lucide-react";
import { db } from "@/lib/firebase";

type ReportSection = {
  grade: string;
  section: string;
};

type AttendanceStudent = {
  id: string;
  name: string;
  grade: string;
  section: string;
  status: string;
  teacherName: string;
};

type RawStudent = {
  id?: unknown;
  name?: unknown;
  status?: unknown;
};

type GroupedChartItem = {
  key: string;
  label: string;
  total: number;
  present: number;
  sick: number;
  leave: number;
  absent: number;
  presentPct: number;
  onClick?: () => void;
};

type Props = {
  sections: ReportSection[];
};

const STATUS_META = [
  { key: "present" as const, label: "Ирсэн", color: "#10b981", bg: "#ecfdf5" },
  { key: "sick" as const, label: "Өвчтэй", color: "#3b82f6", bg: "#eff6ff" },
  { key: "leave" as const, label: "Чөлөөтэй", color: "#f59e0b", bg: "#fffbeb" },
  { key: "absent" as const, label: "Тасалсан", color: "#ef4444", bg: "#fef2f2" },
];

// Санах ойн кэш (Firebase уншилтыг багасгана, Fast Refresh-д устахгүй)
const reportCache: Record<string, AttendanceStudent[]> = {};
let hasInitializedLatestDate = false;

function getToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDate(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function normalizeGrade(value: unknown) {
  return String(value ?? "").match(/\d+/)?.[0] ?? "";
}

function normalizeSection(value: unknown) {
  const text = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .toLocaleUpperCase("mn-MN");

  return text.match(/[А-ЯЁӨҮ]$/)?.[0] ?? text;
}

function parseSnapshotDocs(
  docs: Array<{ data: () => Record<string, unknown> }>,
  filterDate?: string
) {
  const rows: AttendanceStudent[] = [];

  docs.forEach((item) => {
    const data = item.data();
    const docDate = String(data.date ?? "");
    if (filterDate && docDate !== filterDate) return;

    const grade = normalizeGrade(data.grade);
    const section = normalizeSection(data.section);
    const teacherName = String(data.teacherName ?? "");
    const savedStudents = Array.isArray(data.students)
      ? (data.students as RawStudent[])
      : [];

    savedStudents.forEach((student) => {
      rows.push({
        id: String(student.id ?? ""),
        name: String(student.name ?? ""),
        grade,
        section,
        status: String(student.status ?? ""),
        teacherName,
      });
    });
  });

  return rows;
}

export default function ReportsPage({ sections }: Props) {
  const today = getToday();
  const yesterday = useMemo(() => shiftDate(today, -1), [today]);

  const [reportDate, setReportDate] = useState(today);
  const [latestAvailableDate, setLatestAvailableDate] = useState<string | null>(
    null
  );

  const [reportGrade, setReportGrade] = useState("Бүгд");
  const [reportSection, setReportSection] = useState("Бүгд");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Бүгд");

  const [attendance, setAttendance] = useState<AttendanceStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadReport() {
      // 1. Хэрэв тухайн өдрийн өгөгдөл кэш дотор байвал Firestore руу огт хандахгүй
      if (Object.prototype.hasOwnProperty.call(reportCache, reportDate)) {
        setAttendance(reportCache[reportDate]);
        setLoading(false);
        setError("");
        return;
      }

      setLoading(true);
      setError("");

      try {
        // 2. Анх нэвтрэх үед зөвхөн 1 query-ээр сүүлийн бүртгэлүүдийг татаж өнөөдөр эсвэл хамгийн сүүлийн өдрийг олно
        if (!hasInitializedLatestDate && reportDate === today) {
          hasInitializedLatestDate = true;

          const recentQuery = query(
            collection(db, "attendance"),
            orderBy("date", "desc"),
            limit(40)
          );
          const recentSnap = await getDocs(recentQuery);

          if (!recentSnap.empty) {
            const dates = recentSnap.docs
              .map((d) => String(d.data().date ?? ""))
              .filter(Boolean);
            const newestDate = dates[0] ?? today;
            const targetDate = dates.includes(today) ? today : newestDate;

            const rows = parseSnapshotDocs(recentSnap.docs, targetDate);
            reportCache[targetDate] = rows;

            if (active) {
              setLatestAvailableDate(newestDate);
              if (targetDate !== reportDate) {
                setReportDate(targetDate);
              } else {
                setAttendance(rows);
              }
            }
            return;
          } else {
            reportCache[today] = [];
            if (active) setAttendance([]);
            return;
          }
        }

        // 3. Бусад огноо сонгосон үед зөвхөн тухайн өдрийг татаж кэшлэнэ
        const q = query(
          collection(db, "attendance"),
          where("date", "==", reportDate)
        );
        const snapshot = await getDocs(q);
        const rows = parseSnapshotDocs(snapshot.docs);

        reportCache[reportDate] = rows;

        if (rows.length > 0 && active) {
          setLatestAvailableDate((prev) =>
            !prev || reportDate > prev ? reportDate : prev
          );
        }

        if (active) {
          setAttendance(rows);
        }
      } catch (err) {
        console.error("Ирцийн тайлан татах алдаа:", err);
        if (active) {
          setAttendance([]);
          setError(
            "Ирцийн мэдээлэл татаж чадсангүй. Firestore Rules болон индексээ шалгана уу."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadReport();

    return () => {
      active = false;
    };
  }, [reportDate, today]);

  // Анги, бүлгээр шүүгдсэн үндсэн жагсаалт
  const classFilteredAttendance = useMemo(() => {
    return attendance.filter((student) => {
      const gradeMatch =
        reportGrade === "Бүгд" || student.grade === normalizeGrade(reportGrade);

      let sectionMatch = true;
      if (reportSection !== "Бүгд") {
        const [selectedGrade = "", selectedLetter = ""] =
          reportSection.split("|");
        sectionMatch =
          student.grade === selectedGrade && student.section === selectedLetter;
      }

      return gradeMatch && sectionMatch;
    });
  }, [attendance, reportGrade, reportSection]);

  // Хайлт болон Төлөвөөр нэмж шүүгдсэн хүснэгтийн жагсаалт
  const tableAttendance = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return classFilteredAttendance.filter((student) => {
      const statusMatch =
        statusFilter === "Бүгд" || student.status === statusFilter;

      if (!statusMatch) return false;
      if (!q) return true;

      const fullClass = `${student.grade}${student.section}`.toLowerCase();
      return (
        student.name.toLowerCase().includes(q) ||
        fullClass.includes(q) ||
        student.teacherName.toLowerCase().includes(q)
      );
    });
  }, [classFilteredAttendance, searchQuery, statusFilter]);

  // Нийт тоон үзүүлэлт
  const counts = useMemo(() => {
    const total = classFilteredAttendance.length;
    const present = classFilteredAttendance.filter(
      (s) => s.status === "Ирсэн"
    ).length;
    const sick = classFilteredAttendance.filter(
      (s) => s.status === "Өвчтэй"
    ).length;
    const leave = classFilteredAttendance.filter(
      (s) => s.status === "Чөлөөтэй"
    ).length;
    const absent = classFilteredAttendance.filter(
      (s) => s.status === "Тасалсан"
    ).length;

    const pct = (val: number) =>
      total > 0 ? Math.round((val / total) * 100) : 0;

    return {
      total,
      present,
      sick,
      leave,
      absent,
      presentPct: pct(present),
      sickPct: pct(sick),
      leavePct: pct(leave),
      absentPct: pct(absent),
    };
  }, [classFilteredAttendance]);

  // Зэрэгцсэн босоо баганан графикийн өгөгдөл
  const chartData = useMemo(() => {
    // 1. Анги болон Бүлэг хоёуланг нь сонгосон үед -> Тухайн бүлгийн 4 төлөвийн босоо багана
    if (reportGrade !== "Бүгд" && reportSection !== "Бүгд") {
      const items: GroupedChartItem[] = [
        {
          key: "present",
          label: "Ирсэн",
          total: counts.total,
          present: counts.present,
          sick: 0,
          leave: 0,
          absent: 0,
          presentPct: counts.presentPct,
        },
        {
          key: "sick",
          label: "Өвчтэй",
          total: counts.total,
          present: 0,
          sick: counts.sick,
          leave: 0,
          absent: 0,
          presentPct: counts.sickPct,
        },
        {
          key: "leave",
          label: "Чөлөөтэй",
          total: counts.total,
          present: 0,
          sick: 0,
          leave: counts.leave,
          absent: 0,
          presentPct: counts.leavePct,
        },
        {
          key: "absent",
          label: "Тасалсан",
          total: counts.total,
          present: 0,
          sick: 0,
          leave: 0,
          absent: counts.absent,
          presentPct: counts.absentPct,
        },
      ];

      return {
        mode: "single-section" as const,
        title: `${reportSection.replace("|", "")} бүлгийн ирцийн задаргаа`,
        maxBarValue: Math.max(
          counts.present,
          counts.sick,
          counts.leave,
          counts.absent,
          1
        ),
        items,
      };
    }

    // 2. Зөвхөн Анги сонгосон үед -> Тухайн ангийн бүлэг болгоноор 4 босоо багана
    if (reportGrade !== "Бүгд" && reportSection === "Бүгд") {
      const targetGrade = normalizeGrade(reportGrade);
      const map = new Map<string, GroupedChartItem>();

      attendance
        .filter((s) => s.grade === targetGrade)
        .forEach((s) => {
          const sec = s.section || "?";
          const key = `${targetGrade}|${sec}`;
          if (!map.has(key)) {
            map.set(key, {
              key,
              label: `${targetGrade}${sec}`,
              total: 0,
              present: 0,
              sick: 0,
              leave: 0,
              absent: 0,
              presentPct: 0,
              onClick: () => setReportSection(key),
            });
          }
          const entry = map.get(key)!;
          entry.total += 1;
          if (s.status === "Ирсэн") entry.present += 1;
          else if (s.status === "Өвчтэй") entry.sick += 1;
          else if (s.status === "Чөлөөтэй") entry.leave += 1;
          else if (s.status === "Тасалсан") entry.absent += 1;
        });

      const items = Array.from(map.values())
        .map((item) => ({
          ...item,
          presentPct:
            item.total > 0 ? Math.round((item.present / item.total) * 100) : 0,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "mn"));

      const maxBarValue = Math.max(
        ...items.flatMap((i) => [i.present, i.sick, i.leave, i.absent]),
        1
      );

      return {
        mode: "by-section" as const,
        title: `${targetGrade}-р ангийн бүлгүүдийн ирц`,
        maxBarValue,
        items,
      };
    }

    // 3. Анги сонгоогүй үед -> Анги болгоноор 4 босоо багана
    const map = new Map<string, GroupedChartItem>();
    attendance.forEach((s) => {
      const g = s.grade || "?";
      if (!map.has(g)) {
        map.set(g, {
          key: g,
          label: `${g}-р анги`,
          total: 0,
          present: 0,
          sick: 0,
          leave: 0,
          absent: 0,
          presentPct: 0,
          onClick: () => {
            setReportGrade(g);
            setReportSection("Бүгд");
          },
        });
      }
      const entry = map.get(g)!;
      entry.total += 1;
      if (s.status === "Ирсэн") entry.present += 1;
      else if (s.status === "Өвчтэй") entry.sick += 1;
      else if (s.status === "Чөлөөтэй") entry.leave += 1;
      else if (s.status === "Тасалсан") entry.absent += 1;
    });

    const items = Array.from(map.values())
      .map((item) => ({
        ...item,
        presentPct:
          item.total > 0 ? Math.round((item.present / item.total) * 100) : 0,
      }))
      .sort((a, b) => Number(a.key) - Number(b.key));

    const maxBarValue = Math.max(
      ...items.flatMap((i) => [i.present, i.sick, i.leave, i.absent]),
      1
    );

    return {
      mode: "by-grade" as const,
      title: "Нийт ангиудын ирцийн харьцуулалт",
      maxBarValue,
      items,
    };
  }, [attendance, reportGrade, reportSection, counts]);

  const grades = useMemo(
    () =>
      Array.from(
        new Set(sections.map((s) => normalizeGrade(s.grade)).filter(Boolean))
      ).sort((a, b) => Number(a) - Number(b)),
    [sections]
  );

  const availableSections = useMemo(() => {
    const uniqueMap = new Map<string, { grade: string; section: string }>();

    sections.forEach((s) => {
      const grade = normalizeGrade(s.grade);
      const section = normalizeSection(s.section);
      if (!grade || !section) return;

      if (reportGrade === "Бүгд" || grade === normalizeGrade(reportGrade)) {
        uniqueMap.set(`${grade}|${section}`, { grade, section });
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => {
      const gradeDiff = Number(a.grade) - Number(b.grade);
      if (gradeDiff !== 0) return gradeDiff;
      return a.section.localeCompare(b.section, "mn");
    });
  }, [sections, reportGrade]);


  function exportCsv() {
    if (tableAttendance.length === 0) return;

    const groupedMap = new Map<
      string,
      {
        grade: string;
        section: string;
        className: string;
        total: number;
        present: number;
        sickNames: string[];
        leaveNames: string[];
        absentNames: string[];
      }
    >();

    tableAttendance.forEach((s) => {
      const className = `${s.grade}${s.section}`;
      if (!groupedMap.has(className)) {
        groupedMap.set(className, {
          grade: s.grade,
          section: s.section,
          className,
          total: 0,
          present: 0,
          sickNames: [],
          leaveNames: [],
          absentNames: [],
        });
      }

      const group = groupedMap.get(className)!;
      group.total += 1;

      if (s.status === "Ирсэн") group.present += 1;
      else if (s.status === "Өвчтэй") group.sickNames.push(s.name);
      else if (s.status === "Чөлөөтэй") group.leaveNames.push(s.name);
      else if (s.status === "Тасалсан") group.absentNames.push(s.name);
    });

    const sortedGroups = Array.from(groupedMap.values()).sort((a, b) => {
      const gradeDiff = Number(a.grade) - Number(b.grade);
      if (gradeDiff !== 0) return gradeDiff;
      return a.section.localeCompare(b.section, "mn");
    });

    // Нүд дотор эхний мөрөнд тоог, доор нь нэрсийг дугаарлаж жагсаах
    const formatCell = (names: string[]) => {
      if (names.length === 0) return "0";
      const list = names.map((n, i) => `${i + 1}. ${n}`).join("\n");
      return `Нийт: ${names.length}\n${list}`;
    };

    // Нийт дүн тооцох
    const sumTotal = sortedGroups.reduce((acc, g) => acc + g.total, 0);
    const sumPresent = sortedGroups.reduce((acc, g) => acc + g.present, 0);
    const sumSick = sortedGroups.reduce((acc, g) => acc + g.sickNames.length, 0);
    const sumLeave = sortedGroups.reduce((acc, g) => acc + g.leaveNames.length, 0);
    const sumAbsent = sortedGroups.reduce((acc, g) => acc + g.absentNames.length, 0);

    const rows = [
      [`53-Р СУРГУУЛИЙН ИРЦИЙН ТАЙЛАН (${reportDate})`],
      [],
      ["№", "Анги", "Нийт", "Ирсэн", "Өвчтэй", "Чөлөөтэй", "Тасалсан"],
      ...sortedGroups.map((g, index) => [
        String(index + 1),
        g.className,
        String(g.total),
        String(g.present),
        formatCell(g.sickNames),
        formatCell(g.leaveNames),
        formatCell(g.absentNames),
      ]),
      [
        "",
        "НИЙТ ДҮН",
        String(sumTotal),
        String(sumPresent),
        String(sumSick),
        String(sumLeave),
        String(sumAbsent),
      ],
    ];

    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")
        )
        .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `irtsiin-tailan-${reportDate}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function renderStatusBadge(status: string) {
    const map: Record<string, { bg: string; color: string }> = {
      Ирсэн: { bg: "#dcfce7", color: "#15803d" },
      Өвчтэй: { bg: "#dbeafe", color: "#1d4ed8" },
      Чөлөөтэй: { bg: "#fef3c7", color: "#b45309" },
      Тасалсан: { bg: "#fee2e2", color: "#b91c1c" },
    };
    const style = map[status] ?? { bg: "#f1f5f9", color: "#475569" };

    return (
      <span
        style={{
          display: "inline-block",
          padding: "3px 10px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          backgroundColor: style.bg,
          color: style.color,
        }}
      >
        {status || "Бүртгэлгүй"}
      </span>
    );
  }

  return (
    <>
      {/* 5 статистик карт нэг мөрөнд */}
      <section
        className="stats"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))",
          gap: "12px",
        }}
      >
        <div
          className="stat"
          onClick={() => setStatusFilter("Бүгд")}
          style={{
            padding: "14px 16px",
            cursor: "pointer",
            outline: statusFilter === "Бүгд" ? "2px solid #64748b" : "none",
          }}
        >
          <div className="stat-icon">
            <Users size={20} />
          </div>
          <div>
            <span>Нийт бүртгэсэн</span>
            <strong>{counts.total}</strong>
          </div>
        </div>

        <div
          className="stat"
          onClick={() =>
            setStatusFilter((prev) => (prev === "Ирсэн" ? "Бүгд" : "Ирсэн"))
          }
          style={{
            padding: "14px 16px",
            cursor: "pointer",
            outline: statusFilter === "Ирсэн" ? "2px solid #16a34a" : "none",
          }}
        >
          <div className="stat-icon" style={{ color: "#16a34a" }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span>Ирсэн ({counts.presentPct}%)</span>
            <strong>{counts.present}</strong>
          </div>
        </div>

        <div
          className="stat"
          onClick={() =>
            setStatusFilter((prev) => (prev === "Өвчтэй" ? "Бүгд" : "Өвчтэй"))
          }
          style={{
            padding: "14px 16px",
            cursor: "pointer",
            outline: statusFilter === "Өвчтэй" ? "2px solid #2563eb" : "none",
          }}
        >
          <div className="stat-icon" style={{ color: "#2563eb" }}>
            <HeartPulse size={20} />
          </div>
          <div>
            <span>Өвчтэй ({counts.sickPct}%)</span>
            <strong>{counts.sick}</strong>
          </div>
        </div>

        <div
          className="stat"
          onClick={() =>
            setStatusFilter((prev) =>
              prev === "Чөлөөтэй" ? "Бүгд" : "Чөлөөтэй"
            )
          }
          style={{
            padding: "14px 16px",
            cursor: "pointer",
            outline: statusFilter === "Чөлөөтэй" ? "2px solid #d97706" : "none",
          }}
        >
          <div className="stat-icon" style={{ color: "#d97706" }}>
            <Clock3 size={20} />
          </div>
          <div>
            <span>Чөлөөтэй ({counts.leavePct}%)</span>
            <strong>{counts.leave}</strong>
          </div>
        </div>

        <div
          className="stat"
          onClick={() =>
            setStatusFilter((prev) =>
              prev === "Тасалсан" ? "Бүгд" : "Тасалсан"
            )
          }
          style={{
            padding: "14px 16px",
            cursor: "pointer",
            outline: statusFilter === "Тасалсан" ? "2px solid #dc2626" : "none",
          }}
        >
          <div className="stat-icon" style={{ color: "#dc2626" }}>
            <CircleX size={20} />
          </div>
          <div>
            <span>Тасалсан ({counts.absentPct}%)</span>
            <strong>{counts.absent}</strong>
          </div>
        </div>
      </section>

      {/* Зэрэгцсэн Босоо Баганан График */}
      {!loading && !error && chartData.items.length > 0 && (
        <section
          className="panel"
          style={{ marginTop: 18, marginBottom: 18, padding: "20px 22px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BarChart3 size={18} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: 16 }}>{chartData.title}</h3>
              </div>
              {chartData.mode !== "single-section" && (
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 12,
                    color: "#64748b",
                  }}
                >
                  Багана дээр дарж дэлгэрэнгүй рүү орно уу
                </p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {STATUS_META.map((meta) => (
                <span
                  key={meta.key}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "4px 10px",
                    borderRadius: 999,
                    backgroundColor: meta.bg,
                    color: meta.color,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: meta.color,
                    }}
                  />
                  {meta.label}
                </span>
              ))}
            </div>
          </div>

          <div style={{ overflowX: "auto", paddingBottom: 6 }}>
            <div
              style={{
                position: "relative",
                minWidth:
                  chartData.mode === "single-section"
                    ? 360
                    : Math.max(chartData.items.length * 108, 480),
              }}
            >
              <div
                style={{
                  position: "relative",
                  height: 220,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent:
                    chartData.items.length <= 5 ? "space-around" : "flex-start",
                  gap: 18,
                  padding: "24px 16px 0",
                  borderBottom: "2px solid #cbd5e1",
                  backgroundImage:
                    "linear-gradient(to top, #f1f5f9 1px, transparent 1px)",
                  backgroundSize: "100% 55px",
                }}
              >
                {chartData.items.map((item) => {
                  const isSingle = chartData.mode === "single-section";

                  if (isSingle) {
                    const meta =
                      STATUS_META.find((m) => m.key === item.key) ??
                      STATUS_META[0];
                    const val = item[meta.key];
                    const heightPct = (val / chartData.maxBarValue) * 100;

                    return (
                      <div
                        key={item.key}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          flex: "1 1 70px",
                          maxWidth: 100,
                          height: "100%",
                          justifyContent: "flex-end",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: meta.color,
                            marginBottom: 6,
                          }}
                        >
                          {val}{" "}
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: "#64748b",
                            }}
                          >
                            ({item.presentPct}%)
                          </span>
                        </div>

                        <div
                          style={{
                            width: 44,
                            height: `${Math.max(heightPct, val > 0 ? 6 : 2)}%`,
                            backgroundColor: meta.color,
                            borderRadius: "8px 8px 0 0",
                            boxShadow: "0 4px 10px -2px rgba(0,0,0,0.12)",
                            transition: "height 0.35s ease",
                          }}
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.key}
                      onClick={item.onClick}
                      title={`${item.label} — Нийт: ${item.total} | Ирсэн: ${item.present} (${item.presentPct}%) | Өвчтэй: ${item.sick} | Чөлөөтэй: ${item.leave} | Тасалсан: ${item.absent}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        flex: "1 1 92px",
                        maxWidth: 124,
                        height: "100%",
                        justifyContent: "flex-end",
                        cursor: item.onClick ? "pointer" : "default",
                        padding: "0 4px",
                        borderRadius: "8px 8px 0 0",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#334155",
                          marginBottom: 8,
                          backgroundColor: "#f8fafc",
                          padding: "2px 7px",
                          borderRadius: 999,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        {item.presentPct}% ирц
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "center",
                          gap: 4,
                          width: "100%",
                          height: "80%",
                        }}
                      >
                        {STATUS_META.map((meta) => {
                          const val = item[meta.key];
                          const hPct = (val / chartData.maxBarValue) * 100;

                          return (
                            <div
                              key={meta.key}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                flex: 1,
                                maxWidth: 18,
                                height: "100%",
                                justifyContent: "flex-end",
                              }}
                            >
                              {val > 0 && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: meta.color,
                                    marginBottom: 2,
                                    lineHeight: 1,
                                  }}
                                >
                                  {val}
                                </span>
                              )}
                              <div
                                style={{
                                  width: "100%",
                                  height: `${
                                    val > 0 ? Math.max(hPct, 6) : 2
                                  }%`,
                                  backgroundColor:
                                    val > 0 ? meta.color : "#e2e8f0",
                                  borderRadius: "4px 4px 0 0",
                                  transition: "height 0.35s ease",
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    chartData.items.length <= 5 ? "space-around" : "flex-start",
                  gap: 18,
                  padding: "10px 16px 0",
                }}
              >
                {chartData.items.map((item) => (
                  <div
                    key={item.key}
                    onClick={item.onClick}
                    style={{
                      flex:
                        chartData.mode === "single-section"
                          ? "1 1 70px"
                          : "1 1 92px",
                      maxWidth:
                        chartData.mode === "single-section" ? 100 : 124,
                      textAlign: "center",
                      cursor: item.onClick ? "pointer" : "default",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: item.onClick ? "#1e293b" : "#334155",
                      }}
                    >
                      {item.label}
                    </div>
                    {chartData.mode !== "single-section" && (
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        Нийт {item.total}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Ирцийн тайлан хүснэгт ба хайлт */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Ирцийн тайлан</h2>
            <div className="panel-sub">
              Өдөр, анги, бүлгээр шүүх болон сурагчаар хайх
              {latestAvailableDate && reportDate !== today && (
                <span style={{ marginLeft: 8, color: "#2563eb" }}>
                  • {reportDate}-ны ирц
                </span>
              )}
            </div>
          </div>

          <button
            className="success"
            onClick={exportCsv}
            disabled={loading || tableAttendance.length === 0}
          >
            <Download size={16} style={{ verticalAlign: "middle" }} />
            Excel файл татах
          </button>
        </div>

        {/* Уян хатан шүүлтүүр ба Ирц хайх талбар */}
        <div
          className="toolbar"
          style={{
            marginBottom: 18,
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              type="button"
              className="secondary"
              title="Өмнөх өдөр"
              onClick={() => setReportDate((prev) => shiftDate(prev, -1))}
              style={{ padding: "8px 10px" }}
            >
              <ChevronLeft size={16} />
            </button>

            <input
              type="date"
              value={reportDate}
              max={today}
              onChange={(e) => {
                if (e.target.value) setReportDate(e.target.value);
              }}
            />

            <button
              type="button"
              className="secondary"
              title="Дараагийн өдөр"
              disabled={reportDate >= today}
              onClick={() => setReportDate((prev) => shiftDate(prev, 1))}
              style={{ padding: "8px 10px" }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            type="button"
            className="secondary"
            onClick={() => setReportDate(today)}
            disabled={reportDate === today}
          >
            <Calendar size={14} />
            Өнөөдөр
          </button>

          <button
            type="button"
            className="secondary"
            onClick={() => setReportDate(yesterday)}
            disabled={reportDate === yesterday}
          >
            Өчигдөр
          </button>

          {latestAvailableDate &&
            latestAvailableDate !== today &&
            latestAvailableDate !== yesterday && (
              <button
                type="button"
                className="secondary"
                onClick={() => setReportDate(latestAvailableDate)}
                disabled={reportDate === latestAvailableDate}
              >
                Сүүлийн ирц ({latestAvailableDate.slice(5)})
              </button>
            )}

          {/* Анги сонгох */}
          <select
            value={reportGrade}
            onChange={(e) => {
              setReportGrade(e.target.value);
              setReportSection("Бүгд");
            }}
          >
            <option value="Бүгд">Бүх анги</option>
            {grades.map((grade) => (
              <option key={grade} value={grade}>
                {grade}-р анги
              </option>
            ))}
          </select>

          {/* Бүлэг сонгох */}
          <select
            value={reportSection}
            onChange={(e) => {
              const val = e.target.value;
              setReportSection(val);
              if (val !== "Бүгд" && reportGrade === "Бүгд") {
                const [g] = val.split("|");
                if (g) setReportGrade(g);
              }
            }}
          >
            <option value="Бүгд">Бүх бүлэг</option>
            {availableSections.map(({ grade, section }) => {
              const value = `${grade}|${section}`;
              return (
                <option key={value} value={value}>
                  {grade}
                  {section}
                </option>
              );
            })}
          </select>

          {/* Төлөвөөр шүүх */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="Бүгд">Бүх төлөв</option>
            <option value="Ирсэн">Ирсэн</option>
            <option value="Өвчтэй">Өвчтэй</option>
            <option value="Чөлөөтэй">Чөлөөтэй</option>
            <option value="Тасалсан">Тасалсан</option>
          </select>

          {/* Сурагч / Анги / Багш хайх */}
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              flex: "1 1 200px",
              minWidth: 190,
            }}
          >
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 10,
                color: "#94a3b8",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Сурагч, анги, багш хайх..."
              style={{
                width: "100%",
                paddingLeft: 32,
                paddingRight: searchQuery ? 28 : 10,
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                title="Цэвэрлэх"
                style={{
                  position: "absolute",
                  right: 6,
                  background: "none",
                  border: "none",
                  padding: 2,
                  cursor: "pointer",
                  color: "#64748b",
                  display: "flex",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Тайлангийн үр дүн */}
        {loading ? (
          <p style={{ padding: 20 }}>Ирцийн мэдээлэл татаж байна...</p>
        ) : error ? (
          <p style={{ padding: 20, color: "#dc2626" }}>{error}</p>
        ) : tableAttendance.length === 0 ? (
          <p style={{ padding: 20, color: "#64748b" }}>
            {attendance.length === 0
              ? "Сонгосон өдөр ирц бүртгэгдээгүй байна."
              : "Хайлт болон шүүлтүүрт тохирох илэрц олдсонгүй."}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  <th>№</th>
                  <th>Овог нэр</th>
                  <th>Анги</th>
                  <th>Төлөв</th>
                  <th>Бүртгэсэн багш</th>
                </tr>
              </thead>

              <tbody>
                {tableAttendance.map((student, index) => (
                  <tr
                    key={`${student.id}-${student.grade}-${student.section}-${index}`}
                  >
                    <td>{index + 1}</td>
                    <td>{student.name}</td>
                    <td>
                      {student.grade}
                      {student.section}
                    </td>
                    <td>{renderStatusBadge(student.status)}</td>
                    <td>{student.teacherName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}