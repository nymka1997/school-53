 "use client";

import { useEffect,useMemo, useState } from "react";
import {
  Home, CalendarCheck, Users, GraduationCap, UserRound, ClipboardList,
  FileBarChart, Megaphone, Settings, LogOut, Search, Plus, Pencil, Trash2,
  Download, CheckCircle2, Clock3, CircleX, Menu, X, ChevronDown, Bell,
  BookOpen, ShieldCheck
} from "lucide-react";

import Image from "next/image";
import schoolLogo from "./images/logo.png";
import type { Student, Section,     } from "@/types";
import StudentsTable from "@/components/StudentsTable";
import ClassModal from "@/components/modals/ClassModal";
import StudentModal from "@/components/modals/StudentModal";
import TeachersPage from "@/components/pages/TeachersPage";
import DutyTeacherPage from "@/components/pages/DutyTeacherPage";
import DutySchedulePage from "@/components/pages/DutySchedulePage";
import AnnouncementsPage from "@/components/pages/AnnouncementsPage";
import ReportsPage from "@/components/pages/ReportsPage";
import HomeDashboard from "@/components/pages/HomeDashboard";
import { db } from "@/lib/firebase";
import {
   addDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  deleteDoc,
  updateDoc,
  setDoc,
  doc,
    where,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
type TeacherInfo = {
  name: string;
  subject: string;
  phone: string;
};
type Notice = {
  id: string;
  title: string;
  date: string;
  body: string;
};

const initialSections: Section[] = Array.from(
  { length: 12 },
  (_, i) => ({
    grade: String(i + 1),
    section: "1",
    count: 0,
  })
);

const menu = [
  { id: "home", label: "Үндсэн хуудас", icon: Home },
  
  { id: "sections", label: "Анги, бүлэг", icon: BookOpen },
  { id: "students", label: "Сурагчид", icon: GraduationCap },
  { id: "teachers", label: "Багш нар", icon: UserRound },
  { id: "duty", label: "Жижүүр багш", icon: ClipboardList },
  { id: "duty-schedule", label: "Жижүүрийн хуваарь", icon: CalendarCheck },
  { id: "reports", label: "Ирцийн тайлан", icon: FileBarChart },
  { id: "news", label: "Зар, мэдээ", icon: Megaphone },
  { id: "settings", label: "Тохиргоо", icon: Settings },
];

export default function Page() {
  const [page, setPage] = useState("login");
  const [role, setRole] = useState<"Админ" | "Багш">("Админ");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [sections, setSections] = useState<Section[]>(initialSections);
 const [notices, setNotices] = useState<Notice[]>([]);
  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [toast, setToast] = useState("");
  const [showClassModal, setShowClassModal] = useState(false);
  const [className, setClassName] = useState("6А");
 
  const [classSection, setClassSection] = useState("1");
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [classTeacher, setClassTeacher] = useState("");
  const [classRoom, setClassRoom] = useState("");
const [building, setBuilding] = useState("");
const [classShift, setClassShift] = useState("Өглөө");
const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
const [selectedGrade, setSelectedGrade] = useState("1");
const [selectedSection, setSelectedSection] = useState("А");
const [academicYear, setAcademicYear] = useState("2026-2027");
const [graduationCohort, setGraduationCohort] = useState(53); // Анхны утга: 53 (дараа жил 54, 55 гээд нэмэгдэнэ)
const [promotingGrades, setPromotingGrades] = useState(false);
const [editingClass, setEditingClass] = useState<{
  grade: string;
  section: string;
  teacher: string;
  subject: string;
  classRoom: string;
  building: string;
  shift: string;
} | null>(null);

const [teacherDetails, setTeacherDetails] = useState<TeacherInfo[]>([]);


const mongolianAlphabet = [
  "А", "Б", "В", "Г", "Д", "Е", "Ё", "Ж", "З", "И",
  "Й", "К", "Л", "М", "Н", "О", "Ө", "П", "Р", "С",
  "Т", "У", "Ү", "Ф", "Х", "Ц", "Ч", "Ш", "Щ", "Ъ",
  "Ы", "Ь", "Э", "Ю", "Я"
];
console.log("========== AUTH CHECK ==========");
console.log("UID:", auth.currentUser?.uid);
console.log("Auth Project:", auth.app.options.projectId);
console.log("Firestore Project:", db.app.options.projectId);
console.log(
  "ADMIN:",
  auth.currentUser?.uid === "LbBqMciKATfXslfjPcVhLRRj0hD3"
);
console.log("================================");

useEffect(() => {
  const unsubscribe = auth.onAuthStateChanged((user) => {
    console.log("AUTH STATE CHANGED:", {
      uid: user?.uid,
      email: user?.email,
      projectId: auth.app.options.projectId,
    });
  });

  return () => unsubscribe();
}, []);
useEffect(() => {
  if (page === "login" || !auth.currentUser) return;

  const unsubscribe = onSnapshot(doc(db, "settings", "school"), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data.academicYear) setAcademicYear(String(data.academicYear));
      if (typeof data.graduationCohort === "number") {
        setGraduationCohort(data.graduationCohort);
      }
    }
  });

  return () => unsubscribe();
}, [page === "login"]);

useEffect(() => {
  if (page === "login" || !auth.currentUser) return;
  const unsubscribe = onSnapshot(
    collection(db, "students"),
    (snapshot) => {
      const counts: Record<string, number> = {};

      snapshot.docs.forEach((item) => {
        const data = item.data();

        const grade = String(data.grade ?? "").trim();
        const section = String(data.section ?? "").trim();

        if (grade && section) {
          const key = `${grade}-${section}`;
          counts[key] = (counts[key] || 0) + 1;
        }
        
      });

      setStudentCounts(counts);
    },
    (error) => {
      console.error("Сурагчийн тоо татах алдаа:", error);
    }
  );

  return unsubscribe;
}, [page === "login"]);

useEffect(() => {
  if (page === "login" || !auth.currentUser) return;
  const q = query(
    collection(db, "classes"),
    orderBy("createdAt", "desc")
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const savedSections = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as Section[];

      setSections(savedSections);

      // Хэрэв одоо сонгогдсон анги Firebase-ийн жагсаалтад байхгүй бол эхний бүртгэлтэй ангийг автоматаар сонгоно
      if (savedSections.length > 0) {
        const hasCurrent = savedSections.some(
          (s) =>
            String(s.grade).trim() === String(selectedGrade).trim() &&
            String(s.section).trim() === String(selectedSection).trim()
        );
        if (!hasCurrent) {
          setSelectedGrade(String(savedSections[0].grade).trim());
          setSelectedSection(String(savedSections[0].section).trim());
        }
      }
    },
    (error) => {
      console.error("Firebase анги унших алдаа:", error);
      notify("Ангийн мэдээлэл уншиж чадсангүй");
    }
  );

  return () => unsubscribe();
}, [page === "login"]);

async function updateClassInfo() {
  if (!editingClass) return;

  const {
    grade,
    section,
    teacher,
    classRoom,
    building,
    shift,
  } = editingClass;

  if (!teacher || !classRoom || !building || !shift) {
    notify("Бүх мэдээллийг бөглөнө үү");
    return;
  }

  try {
    const snapshot = await getDocs(collection(db, "classes"));

    // Өөр ангид энэ багш оноогдсон эсэх
    const teacherExists = snapshot.docs.some((item) => {
      const data = item.data();

      const sameClass =
        String(data.grade).trim().toLowerCase() === grade.trim().toLowerCase() &&
        String(data.section).trim().toLowerCase() === section.trim().toLowerCase();

      const sameTeacher =
        String(data.teacher ?? "").trim().toLowerCase() === teacher.trim().toLowerCase();

      return sameTeacher && !sameClass;
    });

    if (teacherExists) {
      notify("Энэ багш өөр ангийг хариуцаж байгаа байна");
      return;
    }

    const target = snapshot.docs.find((item) => {
      const data = item.data();

      return (
        String(data.grade).trim().toLowerCase() === grade.trim().toLowerCase() &&
        String(data.section).trim().toLowerCase() === section.trim().toLowerCase()
      );
    });

    if (!target) {
      notify("Анги олдсонгүй");
      return;
    }

    await updateDoc(doc(db, "classes", target.id), {
      teacher,
      classRoom,
      building,
      shift,
      updatedAt: serverTimestamp(),
    });

    setEditingClass(null);
    notify("Ангийн мэдээлэл шинэчлэгдлээ");

  } catch (error) {
    console.error("Анги шинэчлэх алдаа:", error);
    notify("Мэдээлэл шинэчилж чадсангүй");
  }
}

const [teachers, setTeachers] = useState<string[]>([]);

useEffect(() => {
  if (page === "login" || !auth.currentUser) return;
  const unsubscribe = onSnapshot(
    collection(db, "teachers"),
    (snapshot) => {
      const details = snapshot.docs.map((item) => {
        const data = item.data();

        return {
          name: String(data.name ?? "").trim(),
          subject: String(data.subject ?? "").trim(),
          phone: String(data.phone ?? "").trim(),
          
        };
        
      }).filter((t) => t.name.length > 0);

      setTeacherDetails(details);
      setTeachers(details.map((t) => t.name));
    },
    (error) => {
      console.error("Багшийн жагсаалт унших алдаа:", error);
      notify("Багшийн жагсаалтыг уншиж чадсангүй");
    }
  );

  return () => unsubscribe();
}, [page === "login"]);



useEffect(() => {
  if (page === "login" || !auth.currentUser) return;

  const unsubscribe = onSnapshot(
    query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc")
    ),
    (snapshot) => {
      const savedNotices: Notice[] = snapshot.docs.map((item) => {
        const data = item.data();

        return {
          id: item.id,
          title: String(data.title ?? ""),
          body: String(data.body ?? ""),
          date: String(data.date ?? ""),
        };
      });

      setNotices(savedNotices);
      console.log("Зар амжилттай татагдлаа:", savedNotices.length);
    },
    (error) => {
      console.error("Зар татах алдаа:", error.code, error.message);
      notify("Зар, мэдээ татаж чадсангүй");
    }
  );

  return () => unsubscribe();
}, [page === "login"]);


useEffect(() => {
  if (page === "login" || !auth.currentUser) return;
  const unsubscribe = onSnapshot(
    collection(db, "students"),
    (snapshot) => {
      const savedStudents = snapshot.docs.map((item) => {
        const data = item.data();

        return {
          id: item.id,
          name: String(data.name ?? ""),
          grade: String(data.grade ?? ""),
          section: String(data.section ?? ""),
          status: data.status ?? "",
        } as Student;
      });

      setStudents(savedStudents);
    },
    (error) => {
      console.error("Сурагч татах алдаа:", error);
      notify("Сурагчдын мэдээллийг уншиж чадсангүй");
    }
  );

  return () => unsubscribe();
}, [page === "login"]);

async function saveSchoolSettings() {
  if (!isAdminUser) {
    notify("Зөвхөн админ тохиргоо хадгалах эрхтэй");
    return;
  }

  try {
    await setDoc(
      doc(db, "settings", "school"),
      {
        academicYear,
        graduationCohort,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    notify(
      `Тохиргоо хадгалагдлаа (${academicYear}, ${graduationCohort}-р төгсөлт)`
    );
  } catch (err) {
    console.error("Тохиргоо хадгалах алдаа:", err);
    notify("Тохиргоо хадгалж чадсангүй");
  }
}

async function promoteAllGrades() {
  if (!isAdminUser) {
    notify("Зөвхөн админ анги ахиулах эрхтэй");
    return;
  }

  const nextCohort = graduationCohort + 1;

  const confirmed = window.confirm(
    `Анхаар! Энэ үйлдлээр:\n` +
      `1. Одоогийн 12-р ангийн сурагчид "${graduationCohort}-р төгсөлт (${academicYear})" архив руу шилжинэ.\n` +
      `2. Дараагийн төгсөлтийн дугаар ${nextCohort}-р төгсөлт болж шинэчлэгдэнэ.\n` +
      `3. 1–11-р ангийн бүх бүлэг болон сурагчид 1 анги дээшилнэ.\n\n` +
      `Үргэлжлүүлэх үү?`
  );
  if (!confirmed) return;

  setPromotingGrades(true);
  try {
    const classesSnap = await getDocs(collection(db, "classes"));
    const studentsSnap = await getDocs(collection(db, "students"));

    const tasks: Promise<unknown>[] = [];

    // 1. Сурагчдыг шалгах: 12-р ангийг "{graduationCohort}-р төгсөлт" рүү шилжүүлнэ
    studentsSnap.docs.forEach((item) => {
      const data = item.data();
      const currentGrade = Number(String(data.grade ?? "").match(/\d+/)?.[0] ?? 0);

      if (currentGrade === 12) {
        const archiveTask = addDoc(collection(db, "graduates"), {
          ...data,
          cohortNumber: graduationCohort,
          cohortLabel: `${graduationCohort}-р төгсөлт`,
          graduatedAcademicYear: academicYear,
          graduatedAt: serverTimestamp(),
        }).then(() => deleteDoc(doc(db, "students", item.id)));

        tasks.push(archiveTask);
      } else if (currentGrade >= 1 && currentGrade < 12) {
        tasks.push(
          updateDoc(doc(db, "students", item.id), {
            grade: String(currentGrade + 1),
            updatedAt: serverTimestamp(),
          })
        );
      }
    });

    // 2. Анги, бүлгүүдийг шалгах: 12-р ангийн бүлгийг хасна, 1-11 бол +1 ахиулна
    classesSnap.docs.forEach((item) => {
      const data = item.data();
      const currentGrade = Number(String(data.grade ?? "").match(/\d+/)?.[0] ?? 0);

      if (currentGrade === 12) {
        tasks.push(deleteDoc(doc(db, "classes", item.id)));
      } else if (currentGrade >= 1 && currentGrade < 12) {
        tasks.push(
          updateDoc(doc(db, "classes", item.id), {
            grade: String(currentGrade + 1),
            updatedAt: serverTimestamp(),
          })
        );
      }
    });

    await Promise.all(tasks);

    // 3. Дараагийн төгсөлтийн дугаарыг +1 болгож Firestore дээр шинэчлэх (53 -> 54 -> 55...)
    await setDoc(
      doc(db, "settings", "school"),
      {
        academicYear,
        graduationCohort: nextCohort,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setGraduationCohort(nextCohort);

    notify(
      `${graduationCohort}-р төгсөлт бүртгэгдэж, дараагийн төгсөлт ${nextCohort}-р боллоо!`
    );
  } catch (err) {
    console.error("Анги ахиулах алдаа:", err);
    notify("Анги ахиулахад алдаа гарлаа. Firestore эрхээ шалгана уу.");
  } finally {
    setPromotingGrades(false);
  }
}

const isAdminUser =
  auth.currentUser?.uid === "LbBqMciKATfXslfjPcVhLRRj0hD3";

const [viewingGrade, setViewingGrade] = useState<string | null>(null);

  const filteredStudents = useMemo(() => students.filter(s =>
    s.grade === selectedGrade && s.section === selectedSection &&
    s.name.toLowerCase().includes(search.toLowerCase())
  ), [students, selectedGrade, selectedSection, search]);
  const counts = useMemo(() => ({
    total: students.length,
    present: students.filter(s => s.status === "Ирсэн").length,
    sick: students.filter(s => s.status === "Өвчтэй").length,
    leave: students.filter(s => s.status === "Чөлөөтэй").length,
    absent: students.filter(s => s.status === "Тасалсан").length,
  }), [students]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }
  function setStatus(id: string, status: Student["status"]) {
    setStudents(old => old.map(s => s.id === id ? { ...s, status } : s));
  }
  function exportCsv() {
    const rows = [["№", "Овог нэр", "Анги", "Бүлэг", "Төлөв"], ...students.map((s, i) => [String(i + 1), s.name, s.grade, s.section, s.status])];
    const csv = "\uFEFF" + rows.map(row => row.map(v => `"${v.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = "suragchiin-irts.csv"; a.click(); URL.revokeObjectURL(url);
  }
  function addStudent() {
    setStudentName("");
    setShowStudentModal(true);
  }

  async function saveStudent() {
  const name = studentName.trim();

  if (!name) {
    notify("Сурагчийн овог нэрийг оруулна уу");
    return;
  }

  if (!selectedGrade || !selectedSection) {
    notify("Анги болон бүлгийг сонгоно уу");
    return;
  }

  try {
    const id = String(Date.now());

    await setDoc(doc(db, "students", id), {
      id: id,
      name,
      grade: selectedGrade,
      section: selectedSection,
      createdAt: serverTimestamp(),
    });

    setShowStudentModal(false);
    setStudentName("");
    notify("Сурагч Firestore-д амжилттай хадгалагдлаа");

  } catch (error) {
    console.error("Сурагч хадгалах алдаа:", error);
    notify("Сурагч хадгалж чадсангүй. Firebase-ийн эрхийг шалгана уу.");
  }
}
  function addSection() {
    setClassName("6А");
    setClassSection("1");
    setShowClassModal(true);
  }

  
async function saveSection() {
  const grade = className.trim();
  const section = classSection.trim();
  const teacher = classTeacher.trim();
  const room = classRoom.trim();
  const selectedBuilding = building.trim();

  if (!grade || !section) {
    notify("Анги болон бүлгийн мэдээллийг бөглөнө үү");
    return;
  }

  if (!teacher) {
    notify("Анги удирдсан багшийг сонгоно уу");
    return;
  }

  if (!room || !selectedBuilding) {
    notify("Ангийн тоот болон байрыг сонгоно уу");
    return;
  }

  try {
    const allClasses = await getDocs(collection(db, "classes"));

    const exists = allClasses.docs.some((item) => {
      const saved = item.data();

      return (
        String(saved.grade ?? "").trim().toLowerCase() === grade.toLowerCase() &&
        String(saved.section ?? "").trim().toLowerCase() === section.toLowerCase()
      );
    });

    if (exists) {
      notify("Энэ анги, бүлэг Firebase-д бүртгэлтэй байна");
      return;
    }

    const teacherAlreadyAssigned = allClasses.docs.some((item) => {
      const saved = item.data();

      return (
        String(saved.teacher ?? "").trim().toLowerCase() === teacher.toLowerCase()
      );
    });

    if (teacherAlreadyAssigned) {
      notify("Энэ багш өөр бүлэг хариуцаж байгаа тул давхар оноох боломжгүй");
      return;
    }
    

    // Ангийн тоот давхардаж байгаа эсэх
    const docRef = await addDoc(collection(db, "classes"), {
  grade,
  section,
  count: 0,
  teacher,
  classRoom: room,
  building: selectedBuilding,
  shift: classShift,
  createdAt: serverTimestamp(),
});
    


    console.log("Firebase-д хадгаллаа:", docRef.id);

    setSelectedGrade(grade);
    setSelectedSection(section);

    setShowClassModal(false);

    setClassTeacher("");
    setClassRoom("");
    setBuilding("");
    setClassName("");
    setClassSection("");
    setClassShift("Өглөө");

    notify("Анги, бүлэг амжилттай хадгалагдлаа");

  } catch (error) {
    console.error("Firebase анги, бүлэг хадгалах алдаа:", error);
    notify("Анги хадгалж чадсангүй. Firebase тохиргоог шалгана уу");
  }
}

async function deleteStudent(id: string) {
  try {
    console.log("Устгах ID:", id);
    console.log("Students:", students);

    const student = students.find(
      (s) => String(s.id) === String(id)
    );

    if (!student) {
      notify("Сурагч олдсонгүй");
      return;
    }

    await deleteDoc(doc(db, "students", id));

    setStudents(prev =>
      prev.filter(s => String(s.id) !== String(id))
    );

    notify("Сурагч амжилттай устгагдлаа");
  } catch (error) {
    console.error(error);
    notify("Сурагч устгаж чадсангүй");
  }
}
async function addNotice() {
  if (!isAdminUser) {
    notify("Зөвхөн админ зар нэмэх эрхтэй");
    return;
  }

  const title = noticeTitle.trim();
  const body = noticeBody.trim();

  if (!title || !body) {
    notify("Гарчиг болон мэдээг бөглөнө үү");
    return;
  }

  try {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ulaanbaatar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    await addDoc(collection(db, "announcements"), {
      title,
      body,
      date,
      createdAt: serverTimestamp(),
    });

    setNoticeTitle("");
    setNoticeBody("");

    notify("Зар Firestore-д амжилттай хадгалагдлаа");
  } catch (error) {
    console.error("Зар хадгалах алдаа:", error);
    notify("Зар хадгалж чадсангүй");
  }
}

async function deleteNotice(id: string) {
  if (!isAdminUser) {
    notify("Зөвхөн админ зар устгах эрхтэй");
    return;
  }

  if (!window.confirm("Энэ зарыг устгах уу?")) return;

  try {
    await deleteDoc(doc(db, "announcements", id));
    notify("Зар амжилттай устгагдлаа");
  } catch (error) {
    console.error("Зар устгах алдаа:", error);
    notify("Зар устгаж чадсангүй");
  }
}

  const fieldStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 9,
  fontSize: 14,
  fontWeight: 700,
  color: "#334155",
  width: "100%",
};

const inputStyle = {
  width: "100%",
  height: 48,
  padding: "0 14px",
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  background: "#ffffff",
  color: "#1e293b",
  fontSize: 15,
  fontWeight: 600,
  boxSizing: "border-box" as const,
  outline: "none",
};



  if (page === "login") return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark"></div>
        <h1>53-Р СУРГУУЛЬ</h1><p>Сургуулийн ирцийн систем</p>
       
<form
  onSubmit={async e => {
    e.preventDefault();

    try {
     const result = await signInWithEmailAndPassword(
  auth,
  username.trim(),
  password
);

console.log("НЭВТЭРСЭН UID:", result.user.uid);
console.log("НЭВТЭРСЭН EMAIL:", result.user.email);
console.log(
  "АДМИН ЭРХ:",
  result.user.uid === "LbBqMciKATfXslfjPcVhLRRj0hD3"
);

setPage("home");
notify("Системд амжилттай нэвтэрлээ");
    } catch (error) {
      console.error("Нэвтрэх алдаа:", error);
      notify("Имэйл эсвэл нууц үг буруу байна");
    }
  }}
>

          <label className="field"><UserRound size={17} /><input value={username} onChange={e => setUsername(e.target.value)} placeholder="Нэвтрэх нэр" required /></label>
          <label className="field"><ShieldCheck size={17} /><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Нууц үг" required /></label>
          <button className="primary full" type="submit">Нэвтрэх</button>
        </form>
        
        <p className="demo-note">Одоогийн хувилбарын нэвтрэлт нь загварын горимд ажиллана.</p>
      </section>
    </main>
  );

  const activeLabel = menu.find(m => m.id === page)?.label ?? "Үндсэн хуудас";
  const assignedTeachers = sections
  .map((section) => section.teacher)
  .filter(Boolean);

const availableTeachers = teachers.filter(
  (teacher) => !assignedTeachers.includes(teacher)
);
  return (
    <main className="app-layout">

      <aside className={mobileMenu ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brand-icon">
  <Image
    src={schoolLogo}
    alt="53-р сургуулийн лого"
    width={42}
    height={42}
    className="school-logo"
  />
</span>
          <span><strong>53-р Сургууль</strong><small>Сургуулийн ирцийн систем</small></span><button className="icon-btn" style={{marginLeft:"auto",display:"none"}} onClick={() => setMobileMenu(false)}><X size={16}/></button></div>
        <nav className="nav">{menu.map(item => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? "selected" : ""} onClick={() => { setPage(item.id); setMobileMenu(false); }}><Icon size={16}/>{item.label}</button>; })}</nav>
        <div className="side-bottom"><button onClick={() => setPage("login")}><LogOut size={16}/> Гарах</button></div>
      </aside>
      <section className="content">
        <header className="topbar">
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button className="icon-btn mobile-menu" onClick={() => setMobileMenu(v => !v)} aria-label="Цэс"><Menu size={18}/></button>
            <div><h1>{activeLabel}</h1><p>Сургуулийн ирцийн удирдлагын систем</p></div>
          </div>
          <div className="top-actions"><span className="date-chip">{new Date().toLocaleDateString("sv-SE")}</span><button className="icon-btn" onClick={() => setPage("news")} aria-label="Мэдэгдэл"><Bell size={17}/></button></div>
        </header>
       {page === "home" && (
  <HomeDashboard
    totalStudents={students.length}
    totalTeachers={teachers.length}
    totalClasses={sections.length}
    notices={notices}
    onGoToReports={() => setPage("reports")}
  />
)}

{page === "students" && (
  <section className="panel">
    <div className="panel-head">
      <div>
        <h2>Сурагчдын бүртгэл</h2>
        <div className="panel-sub">Сурагч хайх, нэмэх, мэдээлэл харах</div>
      </div>
      <button className="primary" onClick={addStudent}>
        <Plus size={15} style={{ verticalAlign: "middle" }} /> Сурагч нэмэх
      </button>
    </div>

    <div className="toolbar" style={{ marginBottom: 15 }}>
      {/* Анги сонгох */}
      <select
        value={selectedGrade}
        onChange={(e) => {
          const nextGrade = e.target.value;
          setSelectedGrade(nextGrade);

          const matchingSections = sections
            .filter((s) => String(s.grade ?? "").trim() === nextGrade)
            .sort(
              (a, b) =>
                mongolianAlphabet.indexOf(
                  String(a.section ?? "").trim().toUpperCase()
                ) -
                mongolianAlphabet.indexOf(
                  String(b.section ?? "").trim().toUpperCase()
                )
            );

          setSelectedSection(
            matchingSections[0]
              ? String(matchingSections[0].section ?? "").trim()
              : ""
          );
        }}
      >
        {Array.from(
          new Set(
            sections.map((s) => String(s.grade ?? "").trim()).filter(Boolean)
          )
        )
          .sort((a, b) => Number(a) - Number(b))
          .map((g) => (
            <option key={g} value={g}>
              {g}-р анги
            </option>
          ))}
      </select>

      {/* Бүлэг сонгох */}
      <select
        value={selectedSection}
        onChange={(e) => setSelectedSection(e.target.value)}
      >
        {sections
          .filter(
            (s) =>
              String(s.grade ?? "").trim() === String(selectedGrade).trim()
          )
          .sort(
            (a, b) =>
              mongolianAlphabet.indexOf(
                String(a.section ?? "").trim().toUpperCase()
              ) -
              mongolianAlphabet.indexOf(
                String(b.section ?? "").trim().toUpperCase()
              )
          )
          .map((s) => {
            const sec = String(s.section ?? "").trim();
            return (
              <option key={sec} value={sec}>
                {sec} бүлэг
              </option>
            );
          })}
      </select>

      <div className="searchbox">
        <Search size={16} />
        <input
          placeholder="Сурагчийн нэр..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
    </div>

    <StudentsTable students={filteredStudents} onDelete={deleteStudent} />
  </section>
)}
       
{page === "sections" && (
  <section className="panel">
    <div className="panel-head">
      <div>
        <h2>Анги, бүлгийн бүртгэл</h2>
        <div className="panel-sub">
          Анги дээр дарж бүлгүүдийг дэлгэн харна уу
        </div>
      </div>

      <button className="primary" onClick={addSection}>
        <Plus size={15} /> Анги нэмэх
      </button>
    </div>

    <div style={{ paddingTop: 12 }}>
      {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(
        (grade) => {
          const isOpen = viewingGrade === grade;

          const groups = sections
            .filter((s: Section) => String(s.grade ?? "").trim() === grade)
            .sort((a: Section, b: Section) =>
              String(a.section ?? "").localeCompare(
                String(b.section ?? ""),
                "mn"
              )
            );

          return (
            <div
              key={grade}
              style={{ borderBottom: "1px solid #e2e8f0" }}
            >
              <button
                onClick={() =>
                  setViewingGrade(isOpen ? null : grade)
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  width: "100%",
                  padding: "15px 12px",
                  border: "none",
                  background: isOpen ? "#f1f7ff" : "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "#174574",
                }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 9,
                    background: "#eaf2ff",
                    fontWeight: 700,
                  }}
                >
                  {grade}
                </span>

                <span style={{ flex: 1 }}>
                  <strong>{grade}-р анги</strong>
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      fontSize: 12,
                      color: "#64748b",
                    }}
                  >
                    {groups.length} бүлэг
                  </span>
                </span>

                <span style={{ fontSize: 18 }}>
                  {isOpen ? "⌃" : "⌄"}
                </span>
              </button>

              {isOpen && (
                <div style={{ padding: "4px 12px 14px 62px" }}>
                  {groups.length === 0 && (
                    <div
                      style={{
                        padding: 14,
                        color: "#64748b",
                        fontSize: 13,
                      }}
                    >
                      Бүлэг бүртгэгдээгүй байна.
                    </div>
                  )}

                  {groups.map((s: Section) => {
                    const sectionGrade = String(s.grade ?? "");
                    const sectionName = String(s.section ?? "");
                    const countKey = `${sectionGrade}-${sectionName}`;
                    const realCount = studentCounts[countKey] ?? 0;

                    const isEditing =
                      editingClass?.grade === sectionGrade &&
                      editingClass?.section === sectionName;

                    return (
                      <div
                        key={`${sectionGrade}-${sectionName}`}
                        style={{
                          padding: 14,
                          marginTop: 8,
                          border: "1px solid #e2e8f0",
                          borderRadius: 12,
                          background: "#fff",
                        }}
                      >
                        {!isEditing ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <strong style={{ fontSize: 16 }}>
                                {grade}{sectionName}
                              </strong>

                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 12,
                                  marginTop: 9,
                                  fontSize: 13,
                                  color: "#64748b",
                                }}
                              >
                                <span >
                                  Анги удирдсан багш: 
                                  {(() => {
  const teacher = teacherDetails.find(
    (t) => t.name === s.teacher
  );

  return (
    <>
      <span> {s.teacher || "Оноогоогүй"}</span>
      <span> ({teacher?.subject || "Бүртгэлгүй"})</span>
      <span> Утас: {teacher?.phone || "Бүртгэлгүй"}</span>
    </>
  );
})()}
                                </span>
                                <span>Сурагчдын тоо: {realCount}</span>
                                <span>
                                  Хичээл орох байр: {s.building || "Байргүй"}
                                </span>
                                <span>
                                Тоот: {s.classRoom || "Тоотгүй"}
                                </span>
                                <span>
                                  Ээлж: {s.shift || "Ээлжгүй"}
                                </span>
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                           <button
  className="secondary"
  title="Анги засварлах"
  aria-label="Анги засварлах"
  onClick={() => {
    setEditingClass({
  grade: sectionGrade,
  section: sectionName,
  teacher: String(s.teacher ?? ""),
  subject: teacherDetails.find(
    (t) => t.name === s.teacher
  )?.subject ?? "",
  classRoom: String(s.classRoom ?? ""),
  building: String(s.building ?? ""),
  shift: String(s.shift ?? "Өглөө"),
});
  }}
  style={{
    width: 40,
    height: 40,
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  }}
>
  <Pencil size={17} />
</button>

                         <button
  className="secondary"
  onClick={() => {
    setSelectedGrade(String(s.grade));
    setSelectedSection(String(s.section));
    setSearch("");
    setPage("students");
  }}
>
  Сурагч харах →
</button>
                            </div>
                          </div>
                        ) : (
                          <div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 22,
    padding: 22,
    background: "#f8fafc",
    border: "1px solid #dbe5f1",
    borderRadius: 14,
  }}
>
  {/* Багш */}
 {/* Судлагдахуун */}
<label style={fieldStyle}>
  Судлагдахуун

  <select
    value={editingClass?.subject ?? ""}
    onChange={(e) =>
      setEditingClass((prev) =>
        prev
          ? {
              ...prev,
              subject: e.target.value,
              teacher: "",
            }
          : prev
      )
    }
    style={inputStyle}
  >
    <option value="">Судлагдахуун сонгох</option>

    {Array.from(
      new Set(
        teacherDetails
          .map((t) => t.subject)
          .filter((subject) => subject.trim() !== "")
      )
    ).map((subject) => (
      <option key={subject} value={subject}>
        {subject}
      </option>
    ))}
  </select>
</label>

{/* Анги удирдсан багш */}
<label style={fieldStyle}>
  Анги удирдсан багш

  <select
    value={editingClass?.teacher ?? ""}
    onChange={(e) =>
      setEditingClass((prev) =>
        prev
          ? { ...prev, teacher: e.target.value }
          : prev
      )
    }
    style={inputStyle}
    disabled={!editingClass?.subject}
  >
    <option value="">Багш сонгох</option>

    {teacherDetails
      .filter(
        (t) => t.subject === editingClass?.subject
      )
      .map((t) => (
        <option key={t.name} value={t.name}>
          {t.name}
        </option>
      ))}
  </select>
</label>

  {/* Ангийн тоот */}
  <label style={fieldStyle}>
    Ангийн тоот
    <input
      value={editingClass?.classRoom ?? ""}
      onChange={(e) =>
        setEditingClass((prev) =>
          prev ? { ...prev, classRoom: e.target.value } : prev
        )
      }
      placeholder="Жишээ: 317"
      style={inputStyle}
    />
  </label>

  {/* Байр */}
  <label style={fieldStyle}>
    Байр
    <select
      value={editingClass?.building ?? ""}
      onChange={(e) =>
        setEditingClass((prev) =>
          prev ? { ...prev, building: e.target.value } : prev
        )
      }
      style={inputStyle}
    >
      <option value="">Байр сонгох</option>
      <option value="А байр">А байр</option>
      <option value="Б байр">Б байр</option>
    </select>
  </label>

  {/* Ээлж */}
  <label style={fieldStyle}>
    Ээлж
    <select
      value={editingClass?.shift ?? ""}
      onChange={(e) =>
        setEditingClass((prev) =>
          prev ? { ...prev, shift: e.target.value } : prev
        )
      }
      style={inputStyle}
    >
      <option value="Өглөө">Өглөө</option>
      <option value="Өдөр">Өдөр</option>
    </select>
  </label>

  {/* Товчнууд */}
  <div
    style={{
      gridColumn: "1 / -1",
      display: "flex",
      justifyContent: "flex-end",
      gap: 12,
      marginTop: 4,
    }}
  >
    <button
      className="secondary"
      onClick={() => setEditingClass(null)}
    >
      Болих
    </button>

    <button
      className="primary"
      onClick={updateClassInfo}
    >
      Хадгалах
    </button>
  </div>
</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }
      )}
    </div>
  </section>
)}
        {page === "teachers" && <TeachersPage />}
        {page === "duty" && <DutyTeacherPage />}
        {page === "duty-schedule" && <DutySchedulePage />}
        

        {page === "reports" && (
  <ReportsPage sections={sections} />
)}

   {page === "news" && <AnnouncementsPage />}
   {page === "settings" && (
  <section className="panel">
    <div className="panel-head">
      <div>
        <h2>Системийн тохиргоо</h2>
        <div className="panel-sub">
          Хичээлийн жил солих, анги ахиулах болон техникийн дэмжлэг
        </div>
      </div>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 18,
        marginTop: 10,
      }}
    >
      {/* 1. Хичээлийн жил ба Анги ахиулах хэсэг */}
      <div
        style={{
          padding: 20,
          border: "1px solid #dbe5f1",
          borderRadius: 12,
          background: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, color: "#174574" }}>
          Хичээлийн жил ба Анги шилжилт
        </h3>

        <label style={fieldStyle}>
          Хичээлийн жил
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            style={inputStyle}
          >
            <option value="2025-2026">2025-2026</option>
            <option value="2026-2027">2026-2027</option>
            <option value="2027-2028">2027-2028</option>
            <option value="2028-2029">2028-2029</option>
            <option value="2029-2030">2029-2030</option>
          </select>
        </label>

        <label style={fieldStyle}>
          Одоогийн төгсөх 12-р ангийн төгсөлтийн дугаар
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="number"
              min={1}
              value={graduationCohort}
              onChange={(e) => setGraduationCohort(Number(e.target.value) || 53)}
              style={{ ...inputStyle, maxWidth: 130 }}
            />
            <span style={{ fontSize: 14, color: "#1e293b", fontWeight: 600 }}>
              -р төгсөлт (Дараа жил {graduationCohort + 1}-р болно)
            </span>
          </div>
        </label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="primary"
            onClick={saveSchoolSettings}
          >
            Тохиргоо хадгалах
          </button>

          <button
            type="button"
            className="secondary"
            disabled={promotingGrades}
            onClick={promoteAllGrades}
            style={{
              borderColor: "#2563eb",
              color: "#1d4ed8",
              fontWeight: 600,
            }}
          >
            {promotingGrades
              ? "Шинэчилж байна..."
              : `Бүх ангийг 1 анги ахиулах (+1)`}
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
          * &ldquo;1 анги ахиулах&rdquo; товчийг дарснаар одоогийн 12-р анги{" "}
          <strong>{graduationCohort}-р төгсөлт</strong> болж хадгалагдаад, дараа жилийн
          төгсөлт <strong>{graduationCohort + 1}-р</strong> болж шинэчлэгдэнэ.
        </p>
      </div>

      {/* 2. Холбоо барих / Техникийн дэмжлэг */}
      <div
        style={{
          padding: 20,
          border: "1px solid #dbe5f1",
          borderRadius: 12,
          background: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "#174574" }}>
            Холбоо барих
          </h3>

          <div
            style={{
              display: "grid",
              gap: 8,
              fontSize: 14,
              color: "#334155",
            }}
          >
            <div>
              <span style={{ color: "#64748b" }}>Хариуцсан багш: </span>
              <strong>Нямдаваа</strong>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Албан тушаал / Мэргэжил: </span>
              <strong>Мэдээллийн технологи</strong>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Утасны дугаар: </span>
              <a
                href="tel:99896435"
                style={{
                  color: "#2563eb",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                99896435
              </a>
            </div>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
          Системийн ажиллагаа болон техникийн асуудлаар дээрх дугаараар холбогдоно уу.
        </p>
      </div>
    </div>
  </section>
)}
        </section>
     {toast && (
  <div
    style={{
      position: "fixed",
      top: 25,
      left: "50%",
      transform: "translateX(-50%)",
      background: "#12334e",
      color: "#fff",
      padding: "14px 24px",
      borderRadius: 12,
      boxShadow: "0 8px 30px #0004",
      zIndex: 99999,
      fontSize: 14,
      fontWeight: 600,
      minWidth: 260,
      textAlign: "center",
      animation: "toastIn 0.25s ease",
    }}
  >
    {toast}
  </div>
)}
{showClassModal && (
        <ClassModal
          className={className}
          classSection={classSection}
          setClassName={setClassName}
          setClassSection={setClassSection}
          onClose={() => setShowClassModal(false)}
          onSave={saveSection}
          classTeacher={classTeacher}
setClassTeacher={setClassTeacher}
teacherDetails={teacherDetails.filter((t) =>
  availableTeachers.includes(t.name)
)}
teachers={availableTeachers}
building={building}
setBuilding={setBuilding}
classRoom={classRoom}
setClassRoom={setClassRoom}
classShift={classShift}
setClassShift={setClassShift}
        />
      )}
      {showStudentModal && (
        <StudentModal
          name={studentName}
          setName={setStudentName}
          onClose={() => setShowStudentModal(false)}
          onSave={saveStudent}
        />
      )}

    </main>
  );
}

