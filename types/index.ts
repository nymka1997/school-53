
export type Student = {
  id: string;
  name: string;
  grade: string;
  section: string;
  status: "Ирсэн" | "Өвчтэй" | "Чөлөөтэй" | "Тасалсан";
};

export type Section = {
  id?: string;
  grade: string;
  section: string;
  count: number;
  teacher?: string;
  classRoom?: string;
  building?: string;
  shift?: string;
};

export type Notice = {
  id: number;
  title: string;
  date: string;
  body: string;
};
