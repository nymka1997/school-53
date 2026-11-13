"use client";
type Props = { name: string; setName: (value: string) => void; onClose: () => void; onSave: () => void };
export default function StudentModal({ name, setName, onClose, onSave }: Props) {
  return <div className="custom-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <form className="custom-modal" role="dialog" aria-modal="true" aria-labelledby="student-modal-title" onSubmit={e => { e.preventDefault(); onSave(); }}>
      <h2 id="student-modal-title">Шинэ сурагч нэмэх</h2><p>Сонгосон анги, бүлэгт сурагч бүртгэнэ.</p>
      <label className="modal-field" htmlFor="studentName">Овог, нэр<input id="studentName" value={name} onChange={e => setName(e.target.value)} placeholder="Жишээ: Бат-Эрдэнэ" autoFocus required maxLength={100} /></label>
      <div className="custom-modal-actions"><button type="button" className="custom-modal-cancel" onClick={onClose}>Болих</button><button type="submit" className="custom-modal-save">Хадгалах</button></div>
    </form>
  </div>;
}
