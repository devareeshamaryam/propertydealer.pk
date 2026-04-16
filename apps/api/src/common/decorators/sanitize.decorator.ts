import { Transform } from 'class-transformer';
import * as he from 'he';

/**
 * 🔒 SECURITY: Sanitize decorator to prevent XSS attacks (CRITICAL)
 * 
 * This decorator HTML-encodes string inputs to prevent stored XSS attacks.
 * Apply to all user input fields in DTOs.
 * 
 * @example
 * ```typescript
 * export class CreatePropertyDto {
 *   @IsString()
 *   @Sanitize()
 *   title: string;
 * }
 * ```
 */
export function Sanitize() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      // HTML encode to prevent XSS, and trim whitespace
      return he.encode(value.trim());
    }
    return value;
  });
}
