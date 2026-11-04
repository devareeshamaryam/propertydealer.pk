import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * What the Listing API accepts for a new listing (and, all optional, for an
 * update). Every field of the old version still works the same; the new ones
 * are marked NEW. See docs/listing-api.md.
 *
 * The global ValidationPipe drops fields that aren't declared here and
 * doesn't enforce "required" — the service checks what a listing needs and
 * answers with clear messages.
 */

/** "a, b" or ["a","b"] (multipart sends one string or several). */
const toList = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === ''
    ? undefined
    : Array.isArray(value)
      ? value.map(String).map((s) => s.trim()).filter(Boolean)
      : String(value).split(/\s*[,\n]\s*/).filter(Boolean);
const toBool = ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? undefined : value === true || value === 'true' || value === '1' || value === 1;

export const LISTING_TYPES = ['house', 'apartment', 'flat', 'commercial', 'land', 'shop', 'office', 'factory', 'other', 'hotel', 'restaurant', 'plot'] as const;
export const SIZE_UNITS = ['sqft', 'marla', 'kanal', 'sqyd', 'sqm', 'acre'] as const;

export class CreateListingDto {
  // ── what ────────────────────────────────────────────────────────────────
  @IsOptional() @IsIn(['rent', 'sale'])
  listingType?: 'rent' | 'sale';

  /** One of LISTING_TYPES; common words are understood too (home, villa, portion, residential plot…). */
  @IsOptional() @IsString() @MaxLength(40)
  propertyType?: string;

  // ── where (NEW: smarter) ────────────────────────────────────────────────
  /** An area id from GET /areas. Or the names below. */
  @IsOptional() @IsString()
  area?: string;

  @IsOptional() @IsString() @MaxLength(60)
  cityName?: string;

  /** The area / society / phase / block as people write it: "DHA Phase 6", "Bahria Town Sector C". */
  @IsOptional() @IsString() @MaxLength(120)
  areaName?: string;

  /** NEW — the society and its part, instead of one areaName: societyName "Bahria Town" + subArea "Sector C". */
  @IsOptional() @IsString() @MaxLength(80)
  societyName?: string;

  @IsOptional() @IsString() @MaxLength(60)
  subArea?: string;

  /** Street / house / plot number — shown on the listing. Defaults to "area, city". */
  @IsOptional() @IsString() @MaxLength(200)
  location?: string;

  /** Exact pin on the map (decimal degrees, inside Pakistan). */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(23) @Max(37.5)
  latitude?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(60) @Max(78)
  longitude?: number;

  // ── listing text ────────────────────────────────────────────────────────
  @IsOptional() @IsString() @MaxLength(150)
  title?: string;

  /** Leave out: the address is made from the title + id (/properties/<title>-<id>). */
  @IsOptional() @IsString() @MaxLength(150)
  slug?: string;

  @IsOptional() @IsString() @MaxLength(10000)
  description?: string;

  @IsOptional() @Transform(toList) @IsArray() @IsString({ each: true })
  features?: string[];

  // ── numbers ─────────────────────────────────────────────────────────────
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  price?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(50)
  bedrooms?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(50)
  bathrooms?: number;

  /** Size in square feet. Or `size` + `sizeUnit`, or marla/kanal. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  areaSize?: number;

  /** NEW — size in any unit: size 10 + sizeUnit "marla", size 1 + "kanal", 500 + "sqyd". */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  size?: number;

  @IsOptional() @IsIn(SIZE_UNITS as unknown as string[])
  sizeUnit?: string;

  /** Old style still works: marla 5, or kanal 1 (+ marla 5 for "1 kanal 5 marla"). */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  marla?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  kanal?: number;

  /** Square feet in one marla where it isn't 225 (some cities use 250 or 272.25). Defaults to the city's. */
  @IsOptional() @Type(() => Number) @IsIn([225, 250, 272.25])
  marlaSqft?: number;

  // ── contact ─────────────────────────────────────────────────────────────
  /** The number buyers call (the dealer/owner): 03001234567 or 923001234567. */
  @IsOptional() @IsString() @MaxLength(20)
  contactNumber?: string;

  @IsOptional() @IsString() @MaxLength(20)
  whatsappNumber?: string;

  // ── media ───────────────────────────────────────────────────────────────
  @IsOptional() @IsString() @MaxLength(1000)
  mainPhotoUrl?: string;

  @IsOptional() @Transform(toList) @IsArray() @IsString({ each: true })
  additionalPhotosUrls?: string[];

  /** NEW — copy photos from other websites onto this site (default true), so they never break. */
  @IsOptional() @Transform(toBool) @IsBoolean()
  importImages?: boolean;

  /** NEW — a walkthrough video already uploaded (its URL) and its poster image. */
  @IsOptional() @IsString() @MaxLength(1000)
  videoUrl?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  videoPosterUrl?: string;

  // ── behaviour (NEW) ─────────────────────────────────────────────────────
  /**
   * auto (default): published at once unless the listing checker finds a
   * problem — then it waits for the admin with the reasons. approved: publish
   * now, no check. pending: wait for the admin. draft: save only.
   */
  @IsOptional() @IsIn(['auto', 'approved', 'pending', 'draft'])
  status?: 'auto' | 'approved' | 'pending' | 'draft';

  /** Your own id for this listing. Sending it again returns the same listing instead of a copy (and lets you update it). */
  @IsOptional() @IsString() @MaxLength(120)
  externalId?: string;

  /** With externalId: if it already exists, update it with this data (instead of only returning it). */
  @IsOptional() @Transform(toBool) @IsBoolean()
  upsert?: boolean;

  /** Allow a city that isn't on the site yet to be added (off by default, so typos don't make new cities). */
  @IsOptional() @Transform(toBool) @IsBoolean()
  allowNewCity?: boolean;

  /** Check everything and say what would happen, without saving anything. */
  @IsOptional() @Transform(toBool) @IsBoolean()
  dryRun?: boolean;

  /** Sold / rented / available — for updates. */
  @IsOptional() @IsIn(['available', 'sold', 'rented'])
  availability?: 'available' | 'sold' | 'rented';
}
