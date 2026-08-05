// Amount in words for invoices, e.g. "US Dollars Two Thousand Five Hundred Only".
// INR uses the Indian numbering system (Lakh / Crore); other currencies use the
// international system (Thousand / Million / Billion). Sub-units (paise, cents)
// are spelled out when non-zero.

const CURRENCY_WORDS: Record<string, { main: string; sub: string; indian?: boolean }> = {
  INR: { main: "Rupees", sub: "Paise", indian: true },
  USD: { main: "US Dollars", sub: "Cents" },
  EUR: { main: "Euros", sub: "Cents" },
  GBP: { main: "Pounds", sub: "Pence" },
  AED: { main: "Dirhams", sub: "Fils" },
};

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
  "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

// 0–999 → words.
function underThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(ONES[Math.floor(n / 100)], "Hundred");
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)]);
    n %= 10;
  }
  if (n > 0) parts.push(ONES[n]);
  return parts.join(" ");
}

// International grouping: thousand / million / billion.
function intlWords(n: number): string {
  if (n === 0) return "Zero";
  const groups = [
    { value: 1_000_000_000, label: "Billion" },
    { value: 1_000_000, label: "Million" },
    { value: 1_000, label: "Thousand" },
  ];
  const parts: string[] = [];
  for (const g of groups) {
    if (n >= g.value) {
      parts.push(underThousand(Math.floor(n / g.value)), g.label);
      n %= g.value;
    }
  }
  if (n > 0) parts.push(underThousand(n));
  return parts.join(" ");
}

// Indian grouping: thousand / lakh / crore.
function indianWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1_000);
  n %= 1_000;
  if (crore > 0) parts.push(indianWords(crore), "Crore");
  if (lakh > 0) parts.push(underThousand(lakh), "Lakh");
  if (thousand > 0) parts.push(underThousand(thousand), "Thousand");
  if (n > 0) parts.push(underThousand(n));
  return parts.join(" ");
}

export function amountInWords(amount: number, currency: string): string {
  const cw = CURRENCY_WORDS[currency] ?? { main: currency, sub: "" };
  const toWords = cw.indian ? indianWords : intlWords;
  const whole = Math.floor(amount + 1e-6);
  const sub = Math.round((amount - whole) * 100);
  let out = `${cw.main} ${toWords(whole)}`;
  if (sub > 0 && cw.sub) out += ` and ${cw.sub} ${toWords(sub)}`;
  return `${out} Only`;
}
