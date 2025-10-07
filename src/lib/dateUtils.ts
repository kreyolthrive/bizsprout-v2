export function monthLabel(n: number) {
  return `Month ${n}`;
}

export function nextNQuarters(n = 2) {
  const now = new Date();
  const qNames = ["Q1", "Q2", "Q3", "Q4"];
  const startQ = Math.floor(now.getMonth() / 3);
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    const qIndex = (startQ + i) % 4;
    const year = now.getFullYear() + Math.floor((startQ + i) / 4);
    out.push(`${qNames[qIndex]} ${year}`);
  }
  return out;
}

