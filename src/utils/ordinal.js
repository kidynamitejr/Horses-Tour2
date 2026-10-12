export function ordinal(n) {
  const num = Number(n)
  if (isNaN(num)) return n
  const rem100 = num % 100
  if (rem100 >= 11 && rem100 <= 13) return `${num}th`
  switch (num % 10) {
    case 1: return `${num}st`
    case 2: return `${num}nd`
    case 3: return `${num}rd`
    default: return `${num}th`
  }
}
