
const demoStudents = Array.from({ length: 5376 }, (_, i) => ({
  id: `demo-${i + 1}`,
  name: `Сурагч ${String(i + 1).padStart(4, "0")}`,
  grade: String((Math.floor(i / 448) % 12) + 1),
  section: ["а", "б", "в", "г", "д", "е", "ё"][Math.floor(i / 64) % 7],
  status: "Ирсэн",
}));