/**
 * Phone Number Normalization Utility
 *
 * This utility provides consistent phone number normalization across the entire application.
 * All phone number comparisons and storage should use these functions to ensure consistency.
 *
 * Supported formats (WhatsApp ONLY - LinkedIn IDs are rejected):
 * - +60123456789 → 60123456789
 * - 60123456789 → 60123456789
 * - 0123456789 → 60123456789
 * - 60123456789@s.whatsapp.net → 60123456789
 */

/**
 * Normalize phone number by removing all non-digit characters
 * and ensuring proper country code format.
 *
 * @param phone - Phone number in any format
 * @returns Normalized phone number (digits only, with country code)
 *
 * @example
 * normalizePhoneNumber("+60123456789") // "60123456789"
 * normalizePhoneNumber("60123456789@s.whatsapp.net") // "60123456789"
 * normalizePhoneNumber("0123456789") // "60123456789" (assumes Malaysia)
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return phone;

  // Remove @s.whatsapp.net suffix and any non-digit characters
  let normalized = phone.split("@")[0].replace(/\D/g, "");

  if (!normalized) return phone;

  // Add country code if missing (assuming Malaysia - 60)
  // Malaysian numbers: 10-11 digits (including leading 0)
  // After removing 0: 9-10 digits
  if (normalized.length >= 9 && normalized.length <= 11 && !normalized.startsWith("60")) {
    // Remove leading 0 if present, then add 60
    if (normalized.startsWith("0")) {
      normalized = "60" + normalized.substring(1);
    } else {
      normalized = "60" + normalized;
    }
  }

  return normalized;
}

/**
 * Check if two phone numbers are the same after normalization.
 * This is the recommended way to compare phone numbers.
 *
 * @param phone1 - First phone number
 * @param phone2 - Second phone number
 * @returns true if the phone numbers match after normalization
 *
 * @example
 * isSamePhoneNumber("+60123456789", "60123456789@s.whatsapp.net") // true
 * isSamePhoneNumber("0123456789", "+60123456789") // true
 */
export function isSamePhoneNumber(phone1: string, phone2: string): boolean {
  return normalizePhoneNumber(phone1) === normalizePhoneNumber(phone2);
}

/**
 * Format phone number for display purposes.
 * Adds + and proper spacing for Malaysian numbers.
 *
 * @param phone - Normalized phone number
 * @returns Formatted phone number for display
 *
 * @example
 * formatPhoneNumberDisplay("60123456789") // "+60 12-345 6789"
 * formatPhoneNumberDisplay("60312345678") // "+60 3-1234 5678"
 */
export function formatPhoneNumberDisplay(phone: string): string {
  if (!phone) return "Unknown";

  // Remove any JID suffix if present
  const digitsOnly = phone.split("@")[0].replace(/\D/g, "");

  if (!digitsOnly) return "Unknown";

  // Malaysian numbers (country code 60)
  if (digitsOnly.startsWith("60")) {
    const domestic = digitsOnly.substring(2); // Remove 60

    // Malaysian mobile: 01X-XXX XXXX (starts with 1)
    if (domestic.startsWith("1") && domestic.length >= 9) {
      const operator = domestic.substring(0, 3); // 012, 013, 014, etc.
      const middle = domestic.substring(3, 6);
      const last = domestic.substring(6, 9);
      return `+60 ${operator}-${middle} ${last}`;
    }

    // Malaysian landline: 0X-XXX XXXX
    if (domestic.length >= 7) {
      const area = domestic.substring(0, 2); // 03, 06, etc.
      const rest = domestic.substring(2);
      if (rest.length >= 6) {
        return `+60 ${area}-${rest.substring(0, 3)} ${rest.substring(3)}`;
      }
      return `+60 ${area}-${rest}`;
    }

    return `+60 ${domestic}`;
  }

  // Indonesian numbers (country code 62)
  if (digitsOnly.startsWith("62")) {
    const domestic = digitsOnly.substring(2);
    if (domestic.startsWith("8") && domestic.length >= 10) {
      const prefix = domestic.substring(0, 3);
      const rest = domestic.substring(3);
      if (rest.length >= 7) {
        return `+62 ${prefix}-${rest.substring(0, 4)}-${rest.substring(4)}`;
      }
      return `+62 ${prefix}-${rest}`;
    }
    return `+62 ${domestic}`;
  }

  // Singapore numbers (country code 65)
  if (digitsOnly.startsWith("65") && digitsOnly.length >= 10) {
    const domestic = digitsOnly.substring(2);
    return `+65 ${domestic.substring(0, 4)} ${domestic.substring(4)}`;
  }

  // US/Canada numbers (country code 1)
  if (digitsOnly.startsWith("1") && digitsOnly.length >= 11) {
    const domestic = digitsOnly.substring(1);
    if (domestic.length === 10) {
      return `+1 ${domestic.substring(0, 3)}-${domestic.substring(3, 6)}-${domestic.substring(6)}`;
    }
    return `+1 ${domestic}`;
  }

  // Default: just add + prefix
  if (digitsOnly.length >= 10 && digitsOnly.length <= 14) {
    return `+${digitsOnly}`;
  }

  return digitsOnly;
}

/**
 * Check if phone number is valid (WhatsApp only - LinkedIn IDs are rejected).
 *
 * @param phone - Phone number to validate
 * @returns true if the phone number format is valid
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return false;

  // REJECT LinkedIn IDs - we only want real WhatsApp phone numbers
  if (phone.startsWith("LI:")) return false;

  // Remove any JID suffix if present
  const cleanPhone = phone.split("@")[0];
  const digitsOnly = cleanPhone.replace(/\D/g, '');

  // Must be all digits
  if (!/^\d+$/.test(digitsOnly)) return false;

  // REJECT LinkedIn IDs (15+ digits) - these are not phone numbers
  if (digitsOnly.length >= 15) return false;

  // Valid WhatsApp numbers are typically 10-14 digits
  if (digitsOnly.length < 10 || digitsOnly.length > 14) return false;

  // Reject obviously fake patterns
  if (/^0+$/.test(digitsOnly)) return false; // All zeros
  if (/^1{10,}$/.test(digitsOnly)) return false; // All ones

  return true;
}
