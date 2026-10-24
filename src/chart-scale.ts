export function weightDomain(values: number[]): [number, number] {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return [0, 100];
  const low = Math.min(...clean),
    high = Math.max(...clean),
    center = (low + high) / 2;
  const span = Math.max(20, center * 0.3, (high - low) * 1.5);
  const step = span > 100 ? 20 : span > 40 ? 10 : 5;
  return [
    Math.max(0, Math.floor((center - span / 2) / step) * step),
    Math.ceil((center + span / 2) / step) * step,
  ];
}

export function trendDomain(kind:string, values:number[]):[number,number] {
 const high=Math.max(0,...values.filter(Number.isFinite));
 const step=kind==="大睡"?2:500;
 const baseline=kind==="大睡"?12:3000;
 return [0,Math.ceil(Math.max(baseline,high*1.2)/step)*step];
}
export function bmiDomain(weights:number[],heightCm:number):[number,number] {
 const divisor=(heightCm/100)**2;
 return weightDomain(weights).map(n=>n/divisor) as [number,number];
}
