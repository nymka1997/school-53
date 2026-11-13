
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Users,
  LoaderCircle,
  AlertCircle,
  UserRound,
} from "lucide-react";

import { auth, db } from "@/lib/firebase";

type Teacher = {
  id: string;
  uid?: string;
  name: string;
  subject: string;
  phone: string;
  role?: string;
  createdAt?: unknown;
};

const emptyForm = {
  name: "",
  subject: "",
  phone: "",
  password: "",
};

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Firestore-оос багшийн жагсаалтыг бодит цагт уншина.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "teachers"),
      (snapshot) => {
        const list: Teacher[] = snapshot.docs.map((item) => {
          const data = item.data();

          return {
            id: item.id,
            uid: data.uid ?? "",
            name: data.name ?? "",
            subject: data.subject ?? "",
            phone: data.phone ?? "",
            role: data.role ?? "teacher",
            createdAt: data.createdAt,
          };
        });

        list.sort((a, b) => a.name.localeCompare(b.name, "mn"));
        setTeachers(list);
        setLoading(false);
      },
      (err) => {
        console.error("Багшийн жагсаалт унших алдаа:", err);
        setError("Багшийн жагсаалт уншиж чадсангүй. Эрхээ шалгана уу.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredTeachers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return teachers;

    return teachers.filter((teacher) =>
      [teacher.name, teacher.subject, teacher.phone]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [teachers, search]);

  function clearForm() {
    setName("");
    setSubject("");
    setPhone("");
    setPassword("");
    setEditing(null);
    setAdding(false);
    setError("");
  }

  function openAddForm() {
    clearForm();
    setAdding(true);
  }

  function editTeacher(teacher: Teacher) {
    setError("");
    setSuccess("");
    setName(teacher.name);
    setSubject(teacher.subject);
    setPhone(teacher.phone);
    setPassword("");
    setEditing(teacher.id);
    setAdding(true);
  }

  async function saveTeacher(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setSuccess("");

    const cleanName = name.trim();
    const cleanSubject = subject.trim();
    const cleanPhone = phone.trim();
    const cleanPassword = password;

    if (!cleanName || !cleanPhone) {
      setError("Багшийн нэр болон утасны дугаарыг оруулна уу.");
      return;
    }

    if (!editing && cleanPassword.length < 6) {
      setError("Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой.");
      return;
    }

    if (editing) {
      setSaving(true);

      try {
        await updateDoc(doc(db, "teachers", editing), {
          name: cleanName,
          subject: cleanSubject,
          phone: cleanPhone,
          updatedAt: serverTimestamp(),
        });

        setSuccess("Багшийн мэдээллийг шинэчиллээ.");
        clearForm();
      } catch (err) {
        console.error("Багш засварлах алдаа:", err);
        setError("Мэдээлэл шинэчилж чадсангүй. Админ эрхээ шалгана уу.");
      } finally {
        setSaving(false);
      }

      return;
    }

    setSaving(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error("Админ эрхээр нэвтэрч байж багш бүртгэнэ үү.");
      }

      // Нууц үгийг Firestore-д хадгалахгүй.
      // API нь Firebase Authentication хэрэглэгчийг сервер дээр үүсгэнэ.
      const token = await currentUser.getIdToken(true);

      const response = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: cleanName,
          subject: cleanSubject,
          phone: cleanPhone,
          password: cleanPassword,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error || result.message || "Багш бүртгэхэд алдаа гарлаа."
        );
      }

      setSuccess("Багшийг амжилттай бүртгэлээ.");
      clearForm();
    } catch (err) {
      console.error("Багш бүртгэх алдаа:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Багш бүртгэх үед тодорхойгүй алдаа гарлаа."
      );
    } finally {
      setSaving(false);
    }
  }
  
async function removeTeacher(teacher: Teacher) {
  const currentUser = auth.currentUser;
const user = auth.currentUser;

if (!user) {
  throw new Error("Хэрэглэгч нэвтрээгүй байна.");
}

const token = await user.getIdToken(true);

console.log("TOKEN EXISTS:", !!token);

const response = await fetch("/api/admin/teachers", {
  method: "DELETE",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  },
  body: JSON.stringify({
    teacherId: teacher.id,
  }),
});
console.log("CLIENT ADMIN UID:", currentUser?.uid);
  const confirmed = window.confirm(
    `"${teacher.name}" багшийг бүрэн устгах уу?\n\nFirestore болон Firebase Authentication-оос устгана.`
  );

  if (!confirmed) return;

  setError("");
  setSuccess("");
  setDeleting(teacher.id);

  try {
    const response = await fetch("/api/admin/teachers", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teacherId: teacher.id,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
  console.error("API алдаа:", response.status, result);

  throw new Error(
    result.error || `Серверийн алдаа: ${response.status}`
  );
}

    setSuccess("Багшийн бүртгэл бүрэн устгагдлаа.");

  } catch (err: any) {
    console.error("Багш устгах алдаа:", err);
    setError(err.message || "Багш устгаж чадсангүй.");
  } finally {
    setDeleting(null);
  }
}



  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Гарчиг */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Багшийн бүртгэл
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Багш нэмэх, мэдээлэл засах болон бүртгэлийг удирдах
          </p>
        </div>

        {!adding && (
          <button
            type="button"
            onClick={openAddForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
          >
            <Plus size={18} />
            Багш нэмэх
          </button>
        )}
      </div>

      {/* Мэдэгдэл */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto"
            aria-label="Алдааны мэдэгдэл хаах"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      {/* Багш нэмэх / засах форм */}
      {adding && (
        <form
          onSubmit={saveTeacher}
          className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              {editing ? "Багшийн мэдээлэл засах" : "Шинэ багш бүртгэх"}
            </h2>

            <button
              type="button"
              onClick={clearForm}
              disabled={saving}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Форм хаах"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="teacher-name"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Багшийн нэр *
              </label>
              <input
                id="teacher-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Овог, нэр"
                autoComplete="name"
                required
                disabled={saving}
                className="w-full rounded-xl border border-gray-300 px-3 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="teacher-subject"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Судлагдахуун
  </label>

  <select
    id="teacher-subject"
    value={subject}
    onChange={(e) => setSubject(e.target.value)}
    disabled={saving}
    className="w-full rounded-xl border border-gray-300 px-3 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
  >
    
    <option value="">Судлагдахуун сонгох</option>
    <option value="Мэдээллийн технологи">Мэдээллийн технологи</option>
    <option value="Бага ангийн багш">Бага ангийн багш</option>
    <option value="Математик">Математик</option>ч 
    <option value="Монгол хэл">Монгол хэл</option>
    <option value="Уран зохиол">Уран зохиол</option>
    <option value="Англи хэл">Англи хэл</option>
    <option value="Орос хэл">Орос хэл</option>
    <option value="Физик">Физик</option>
    <option value="Хими">Хими</option>
    <option value="Биологи">Биологи</option>
    <option value="Газар зүй">Газар зүй</option>
    <option value="Түүх">Түүх</option>
    <option value="Нийгэм судлал">Нийгэм судлал</option>
    <option value="Иргэний ёс зүйн боловсрол">Иргэний ёс зүйн боловсрол</option>
    <option value="Биеийн тамир">Биеийн тамир</option>
    <option value="Дүрслэх урлаг">Дүрслэх урлаг</option>
    <option value="Хөгжим">Хөгжим</option>
    <option value="Технологи">Технологи</option>
  </select>
            </div>

            <div>
              <label
                htmlFor="teacher-phone"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Утасны дугаар *
              </label>
              <input
                id="teacher-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Утасны дугаар"
                autoComplete="tel"
                required
                disabled={saving || Boolean(editing)}
                className="w-full rounded-xl border border-gray-300 px-3 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              />
              {editing && (
                <p className="mt-1 text-xs text-gray-500">
                  Нэвтрэх дугаарыг энэ формоос өөрчлөхгүй.
                </p>
              )}
            </div>

            {!editing && (
              <div>
                <label
                  htmlFor="teacher-password"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Нэвтрэх нууц үг *
                </label>
                <input
                  id="teacher-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Доод тал нь 6 тэмдэгт"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  disabled={saving}
                  className="w-full rounded-xl border border-gray-300 px-3 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={clearForm}
              disabled={saving}
              className="rounded-xl border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Болих
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {saving
                ? "Хадгалж байна..."
                : editing
                  ? "Өөрчлөлт хадгалах"
                  : "Багш бүртгэх"}
            </button>
          </div>
        </form>
      )}

      {/* Нийт багш */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Нийт багш</p>
            <p className="text-2xl font-bold text-gray-900">
              {teachers.length}
            </p>
          </div>
        </div>
      </div>

      {/* Хайлт */}
      <div className="relative">
        <Search
          size={19}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Нэр, хичээл, утасны дугаараар хайх..."
          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Багшийн жагсаалт */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-4">
          <h2 className="font-semibold text-gray-900">
            Багш нарын жагсаалт
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-gray-500">
            <LoaderCircle size={20} className="animate-spin" />
            Мэдээлэл уншиж байна...
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <UserRound size={36} className="mb-3 text-gray-300" />
            <p className="font-medium text-gray-700">
              {search
                ? "Хайлтад тохирох багш олдсонгүй."
                : "Багш бүртгэгдээгүй байна."}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {search
                ? "Хайлтын үгээ өөрчилж үзнэ үү."
                : "Шинэ багш нэмэх товчийг ашиглана уу."}
            </p>
          </div>
        ) : (
          <>
            {/* Компьютерийн хүснэгт */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">№</th>
                    <th className="px-4 py-3 font-medium">Багшийн нэр</th>
                    <th className="px-4 py-3 font-medium">Хичээл</th>
                    <th className="px-4 py-3 font-medium">Утас</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Үйлдэл
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredTeachers.map((teacher, index) => (
                    <tr key={teacher.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-gray-500">
                        {index + 1}
                      </td>
                      <td className="px-4 py-4 font-medium text-gray-900">
                        {teacher.name}
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {teacher.subject || "—"}
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {teacher.phone}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => editTeacher(teacher)}
                            title="Засах"
                            aria-label={`${teacher.name} багшийг засах`}
                            className="rounded-lg border border-gray-200 p-2 text-blue-600 hover:bg-blue-50"
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            type="button"
                            onClick={() => removeTeacher(teacher)}
                            disabled={deleting === teacher.id}
                            title="Устгах"
                            aria-label={`${teacher.name} багшийн бүртгэлийг устгах`}
                            className="rounded-lg border border-gray-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            {deleting === teacher.id ? (
                              <LoaderCircle
                                size={17}
                                className="animate-spin"
                              />
                            ) : (
                              <Trash2 size={17} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Утасны дэлгэц */}
            <div className="divide-y divide-gray-100 md:hidden">
              {filteredTeachers.map((teacher) => (
                <div key={teacher.id} className="space-y-3 p-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {teacher.name}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {teacher.subject || "Хичээл оруулаагүй"}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {teacher.phone}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => editTeacher(teacher)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-blue-600"
                    >
                      <Pencil size={16} />
                      Засах
                    </button>

                    <button
                      type="button"
                      onClick={() => removeTeacher(teacher)}
                      disabled={deleting === teacher.id}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-red-600 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      Устгах
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
