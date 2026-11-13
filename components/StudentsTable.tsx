
"use client";

import type { Student } from "@/types";

type Props = {
  students: Student[];
  onDelete: (id: string) => void;
};

export default function StudentsTable({
  students,
  onDelete,
}: Props) {

  
;
  return (
    
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>№</th>
            <th>Овог нэр</th>
            <th>Анги</th>
            <th>Бүлэг</th>
            <th>Үйлдэл</th>
          </tr>
        </thead>

        <tbody>
          {students.map((s, i) => (
            <tr key={`${s.id}-${i}`}>
              <td>{i + 1}</td>
              <td>
                <strong>{s.name}</strong>
              </td>
              <td>{s.grade}</td>
              <td>{s.section}</td>
              <td>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    if (
                      window.confirm(
                        `${s.name} сурагчийг бүртгэлээс устгах уу?`
                      )
                    ) {
                      onDelete(s.id);
                    }
                  }}
                >
                  Устгах
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {students.length === 0 && (
        <div className="empty">
          Сурагч олдсонгүй.
        </div>
      )}
    </div>
  );
}
