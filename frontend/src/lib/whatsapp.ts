/** Builds a wa.me link from a Tanzanian number such as +255712345678 or 0712345678. */
export function whatsappNumberLink(phone: string, message = ''): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `255${digits.slice(1)}`;
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
