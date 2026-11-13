# Сургуулийн ирцийн систем — модуль бүтэцтэй

## Ажиллуулах
```powershell
npm.cmd install
npm.cmd run dev
```
Дараа нь http://localhost:3000 нээнэ.

## Бүтэц
- `app/page.tsx` — навигац ба үндсэн дэлгэц
- `app/globals.css` — нийтлэг загвар
- `components/pages/TeachersPage.tsx` — багшийн бүртгэл; `TeachersPage.module.css` — тухайн хуудасны CSS
- `components/pages/DutyTeacherPage.tsx` — жижүүрийн бүртгэл; өөрийн CSS module-тэй
- `components/pages/DutySchedulePage.tsx` — жижүүрийн долоо хоногийн хуваарь; өөрийн CSS module-тэй
- `components/modals/` — анги болон сурагч нэмэх цонх
- `components/StudentsTable.tsx` — сурагчдын хүснэгт
- `types/index.ts` — өгөгдлийн төрлүүд

Энэ нь frontend загвар. Өгөгдөл одоогоор сервер/Firebase-д хадгалагдахгүй.
