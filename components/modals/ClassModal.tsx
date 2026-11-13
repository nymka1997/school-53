"use client";
import { useState } from "react";

type TeacherInfo = {
  name: string;
  subject: string;
  phone: string;
}; 
type Props = {
  className: string;
  classSection: string;
  setClassName: (value: string) => void;
  setClassSection: (value: string) => void;
  onClose: () => void;
  onSave: (subject: string) => void;
  classTeacher: string;
  setClassTeacher: (value: string) => void;
  teachers: string[];
  teacherDetails: TeacherInfo[];
  building: string;
  setBuilding: (value: string) => void;
  classRoom: string;
  setClassRoom: (value: string) => void;
  classShift: string;
  setClassShift: (value: string) => void;
  
};

export default function ClassModal({
  className,
  classSection,
  setClassName,
  setClassSection,
  onClose,
  onSave,
  classTeacher,
  setClassTeacher,
  teachers,
  teacherDetails,
  building,
  setBuilding,
  classRoom,
  setClassRoom,
  classShift,
  setClassShift,
}: Props) {
  const [selectedSubject, setSelectedSubject] = useState("");
  return (
    <div
      className="custom-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="custom-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-modal-title"
        onSubmit={(e) => {
  e.preventDefault();
  onSave(selectedSubject);
}}
      >
        <h2 id="class-modal-title">Анги, бүлэг нэмэх</h2>
        <p>
          Шинэ ангийн мэдээллийг оруулна уу. Сурагчийн тоо эхэндээ 0 байна.
        </p>

        <label className="modal-field" htmlFor="className">
          Анги
          <select
            id="className"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            required
            autoFocus
          >
            <option value="">Анги сонгоно уу</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
              <option key={grade} value={`${grade}`}>
                {grade}-р анги
              </option>
            ))}
          </select>
        </label>

        <label className="modal-field" htmlFor="classSection">
          Бүлэг
          <input
            id="classSection"
            value={classSection}
            onChange={(e) => setClassSection(e.target.value)}
            placeholder="Жишээ: А"
            required
            maxLength={10}
          />
        </label>
{/* Судлагдахуун сонгох */}
<label className="modal-field">
  Судлагдахуун
  <select
    value={selectedSubject}
    onChange={(e) => {
      setSelectedSubject(e.target.value);
      setClassTeacher("");
    }}
    required
  >
    <option value="">Судлагдахуун сонгоно уу</option>

    {Array.from(
      new Set(
        teacherDetails
          .map((t) => t.subject)
          .filter((s) => s.trim() !== "")
      )
    ).map((subject) => (
      <option key={subject} value={subject}>
        {subject}
      </option>
    ))}
  </select>
</label>

{/* Анги удирдсан багш */}
<label className="modal-field" htmlFor="classTeacher">
  Анги удирдсан багш
  <select
    id="classTeacher"
    value={classTeacher}
    onChange={(e) => setClassTeacher(e.target.value)}
    required
    disabled={!selectedSubject}
  >
    <option value="">Багш сонгоно уу</option>

    {teacherDetails
      .filter((teacher) => teacher.subject === selectedSubject)
      .map((teacher) => (
        <option key={teacher.name} value={teacher.name}>
          {teacher.name}
        </option>
      ))}
  </select>
</label>
        <label className="modal-field" htmlFor="building">
  Байр
  <select
    id="building"
    value={building}
    onChange={(e) => setBuilding(e.target.value)}
    required
  >
    <option value="">Байр сонгоно уу</option>
    <option value="А байр">А байр</option>
    <option value="Б байр">Б байр</option>
  </select>
</label>
<label className="modal-field" htmlFor="classRoom">
  Ангийн тоот
  <input
    id="classRoom"
    type="text"
    value={classRoom}
    onChange={(e) => setClassRoom(e.target.value)}
    placeholder="Жишээ: 101"
    required
    maxLength={10}
  />
</label>
<label className="modal-field" htmlFor="classShift">
  Ээлж
  <select
    id="classShift"
    value={classShift}
    onChange={(e) => setClassShift(e.target.value)}
    required
  >
    <option value="Өглөө">Өглөө</option>
    <option value="Өдөр">Өдөр</option>
  </select>
</label>

        <div className="custom-modal-actions">
          <button
            type="button"
            className="custom-modal-cancel"
            onClick={onClose}
          >
            Болих
          </button>
          <button type="submit" className="custom-modal-save">
            Хадгалах
          </button>
        </div>
      </form>
    </div>
  );
}
