
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";

import {
  collection,
  onSnapshot,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import styles from "./DutySchedulePage.module.css";

type Building = "А байр" | "Б байр";
type Shift = "Өглөө" | "Өдөр";

type Assignment = {
  id: string;
  date: string;
  building: Building;
  shift: Shift;
  teachers: string[];
};

const buildings: Building[] = ["А байр", "Б байр"];
const shifts: Shift[] = ["Өглөө", "Өдөр"];

function makeKey(date: string, building: Building, shift: Shift) {
  return `${date}_${building}_${shift}`;
}

export default function DutySchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);

  const [assignments, setAssignments] = useState<
    Record<string, string[]>
  >({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const days = useMemo(() => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);

    now.setDate(
      now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7
    );

    return Array.from({ length: 5 }, (_, i) => {
      const date = new Date(now);
      date.setDate(now.getDate() + i);

      return {
        key: date.toLocaleDateString("sv-SE"),
        label: date.toLocaleDateString("mn-MN", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
      };
    });
  }, [weekOffset]);

  // Firebase-ээс зөвхөн уншина
 useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, "dutyAssignments"),
    (snapshot) => {
      const loaded: Record<string, string[]> = {};

      snapshot.docs.forEach((item) => {
        const data = item.data();

        const date = String(data.date ?? "");
        const building = data.building;
        const shift = data.shift;

        if (
          date &&
          buildings.includes(building) &&
          shifts.includes(shift)
        ) {
          loaded[makeKey(date, building, shift)] = [
            String(data.teacher1Name ?? ""),
            String(data.teacher2Name ?? ""),
          ].filter(Boolean);
        }
      });

      setAssignments(loaded);
      setLoading(false);
      setError("");
    },
    (err) => {
      console.error("Хуваарь татах алдаа:", err);
      setError("Хуваарь унших боломжгүй байна.");
      setLoading(false);
    }
  );

  return unsubscribe;
}, []);

  return (
    <div className={styles.page}>
      <section className={styles.panel}>

        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.title}>
            <span>
              <CalendarDays size={22} />
            </span>

            <div>
              <h2>Жижүүр багшийн хуваарь</h2>
              <p>7 хоногийн жижүүр багш нарын хуваарь</p>
            </div>
          </div>

          {/* WEEK NAVIGATION */}
          <div className={styles.controls}>
            <button
              onClick={() => setWeekOffset((v) => v - 1)}
              aria-label="Өмнөх долоо хоног"
            >
              <ChevronLeft size={17} />
            </button>

            <button onClick={() => setWeekOffset(0)}>
              Энэ долоо хоног
            </button>

            <button
              onClick={() => setWeekOffset((v) => v + 1)}
              aria-label="Дараагийн долоо хоног"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ padding: 20 }}>Хуваарь уншиж байна...</p>
        ) : error ? (
          <p role="alert" style={{ padding: 20 }}>
            {error}
          </p>
        ) : (
          <>
            {buildings.map((building) => (
              <section
                key={building}
                style={{ marginTop: 24 }}
              >
                <h3>{building}</h3>

                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Өдөр</th>
                        {shifts.map((shift) => (
                          <th key={shift}>
                            {shift}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {days.map((day) => (
                        <tr key={day.key}>
                          <td>
                            <strong>{day.label}</strong>
                            <small>{day.key}</small>
                          </td>

                          {shifts.map((shift) => {
                            const key = makeKey(
                              day.key,
                              building,
                              shift
                            );

                            const selected =
                              assignments[key] ?? [];

                            return (
                              <td key={key}>
                                <div
                                  style={{
                                    display: "grid",
                                    gap: 8,
                                    minWidth: 160,
                                  }}
                                >
                                  {selected.length > 0 ? (
                                    selected.map((teacher, index) => (
                                      <div
                                        key={index}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 8,
                                          padding: "9px 10px",
                                          background: "var(--card, #f8fafc)",
                                          border: "1px solid #e2e8f0",
                                          borderRadius: 8,
                                        }}
                                      >
                                        <Users
                                          size={15}
                                          color="#64748b"
                                        />

                                        <strong>{teacher}</strong>
                                      </div>
                                    ))
                                  ) : (
                                    <span
                                      style={{
                                        color: "#94a3b8",
                                        fontSize: 13,
                                      }}
                                    >
                                      Хуваарь оруулаагүй
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </>
        )}

        <div className={styles.footer}>
          <span>
            Хуваарь Firebase-ээс автоматаар шинэчлэгдэнэ.
          </span>
        </div>

      </section>
    </div>
  );
}
