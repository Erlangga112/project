/**
 * Utility untuk validasi dan normalisasi nomor WhatsApp Indonesia (+62)
 */

export interface PhoneValidationResult {
  isValid: boolean;
  formattedE164: string; // e.g. "6281234567890" (format yang diterima WhatsApp Cloud API)
  displayFormat: string; // e.g. "+62 812-3456-7890"
  error?: string;
}

/**
 * Normalisasi dan validasi nomor telepon seluler Indonesia
 * Mendukung format:
 * - 081234567890
 * - +6281234567890
 * - 6281234567890
 * - 0812-3456-7890 / +62 812 3456 7890
 */
export function validateAndNormalizeIndonesianPhone(input: string | null | undefined): PhoneValidationResult {
  if (!input || typeof input !== "string") {
    return {
      isValid: false,
      formattedE164: "",
      displayFormat: "",
      error: "Nomor WhatsApp tidak boleh kosong",
    };
  }

  // Hapus karakter non-digit kecuali tanda '+' di awal jika ada
  const cleanInput = input.trim();
  let digits = cleanInput.replace(/[^0-9]/g, "");

  // Jika berawal dari 0 (contoh: 081234567890) -> ganti dengan 6281234567890
  if (digits.startsWith("0")) {
    digits = "62" + digits.substring(1);
  }
  // Jika berawal dari 8 (contoh: 81234567890) -> tambahkan 62 di depan
  else if (digits.startsWith("8")) {
    digits = "62" + digits;
  }

  // Validasi format Indonesia: harus berawalan 628 dan panjang digit 10-15 digit
  // Standar nomor seluler Indonesia: 62 + 8xx (panjang 11 s.d. 14 digit)
  const regexIndoMobile = /^628[1-9][0-9]{7,11}$/;

  if (!regexIndoMobile.test(digits)) {
    return {
      isValid: false,
      formattedE164: digits,
      displayFormat: cleanInput,
      error: "Nomor WhatsApp harus nomor seluler Indonesia yang valid (contoh: +6281234567890 atau 081234567890)",
    };
  }

  // Format display +62 8xx-xxxx-xxxx
  const rest = digits.substring(2); // mulai dari '8'
  const prefix = rest.substring(0, 3); // misal '812'
  const middle = rest.substring(3, 7); // misal '3456'
  const end = rest.substring(7); // sisa

  const display = `+62 ${prefix}-${middle}${end ? `-${end}` : ""}`;

  return {
    isValid: true,
    formattedE164: digits,
    displayFormat: display,
  };
}
