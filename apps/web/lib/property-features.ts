/**
 * The features a Pakistani listing is actually described by, ready to tick.
 *
 * They used to be free text: every agent typed their own ("car porch", "Car
 * Porch", "carporch"), so nothing could be filtered, counted or searched, and
 * two identical houses read as different properties. These are the phrases
 * Zameen, Graana and the local market already use — picked from a list, they
 * mean the same thing on every listing.
 *
 * Existing listings are untouched: whatever was typed into them stays, shown
 * alongside these as a custom feature (see FeaturesPicker).
 */

/** Keys match the capitalised types the property forms use. */
export type PropertyTypeKey =
  | "House"
  | "Apartment"
  | "Flat"
  | "Plot"
  | "Land"
  | "Commercial"
  | "Shop"
  | "Office"
  | "Factory"
  | "Hotel"
  | "Restaurant"
  | "Other";

export interface FeatureGroup {
  title: string;
  /** Which property types this group makes sense for. Empty = all of them. */
  types?: PropertyTypeKey[];
  features: string[];
}

const RESIDENTIAL: PropertyTypeKey[] = ["House", "Apartment", "Flat", "Hotel"];
const BUILT: PropertyTypeKey[] = [
  "House",
  "Apartment",
  "Flat",
  "Commercial",
  "Shop",
  "Office",
  "Factory",
  "Hotel",
  "Restaurant",
];
const OPEN_LAND: PropertyTypeKey[] = ["Plot", "Land"];
const COMMERCIAL: PropertyTypeKey[] = [
  "Commercial",
  "Shop",
  "Office",
  "Factory",
  "Restaurant",
];

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    // What the market actually pays a premium for.
    title: "Main features",
    features: [
      "Corner",
      "Park facing",
      "Boulevard / main road",
      "West open",
      "Double unit",
      "Possession available",
      "Newly built",
      "Renovated",
      "Furnished",
      "Semi furnished",
      "Separate entrance",
      "Facing mosque",
    ],
  },
  {
    title: "Rooms",
    types: RESIDENTIAL,
    features: [
      "Drawing room",
      "Dining room",
      "Lounge / sitting room",
      "Study room",
      "Store room",
      "Powder room",
      "Servant quarter",
      "Laundry room",
      "Basement",
      "Attached bathrooms",
      "Built-in wardrobes",
      "Roof access",
    ],
  },
  {
    title: "Utilities",
    features: [
      "Electricity",
      "Sui gas",
      "Water supply",
      "Water tank",
      "Boring / water pump",
      "Solar panels",
      "Generator",
      "UPS backup",
      "Standby electricity",
      "Internet / fibre",
      "Sewerage",
      "Underground wiring",
    ],
  },
  {
    title: "Finishing",
    types: BUILT,
    features: [
      "Marble flooring",
      "Tile flooring",
      "Wooden flooring",
      "False ceiling",
      "Wood work",
      "Imported fittings",
      "Kitchen cabinets",
      "Double glazed windows",
      "Centrally air conditioned",
      "Air conditioning installed",
      "Heating / gas heaters",
      "Painted recently",
    ],
  },
  {
    title: "Outside",
    features: [
      "Lawn / garden",
      "Car porch",
      "Garage",
      "Parking space",
      "Terrace",
      "Balcony",
      "Swimming pool",
      "Boundary wall",
      "Main gate",
      "Tube well",
      "Servant entrance",
      "Open space",
    ],
  },
  {
    title: "Building facilities",
    types: ["Apartment", "Flat", "Commercial", "Office", "Hotel", "Restaurant"],
    features: [
      "Lift / elevator",
      "Backup lift",
      "Reception",
      "Security staff",
      "CCTV cameras",
      "Intercom",
      "Maintenance staff",
      "Service stairs",
      "Visitor parking",
      "Community lawn",
      "Gym",
      "Prayer area",
    ],
  },
  {
    title: "Society & nearby",
    features: [
      "Gated community",
      "Security 24/7",
      "Mosque nearby",
      "Park nearby",
      "School nearby",
      "Hospital nearby",
      "Market nearby",
      "Public transport nearby",
      "Main highway access",
      "Commercial area nearby",
      "Society maintenance",
      "Street lights",
    ],
  },
  {
    title: "Plot details",
    types: OPEN_LAND,
    features: [
      "Levelled plot",
      "On main road",
      "Approved map / NOC",
      "Possession paid",
      "Utilities at site",
      "Ready for construction",
      "Agricultural land",
      "Residential plot",
      "Commercial plot",
      "Corner plot",
      "Boundary marked",
      "Clear ownership / fard",
    ],
  },
  {
    title: "Commercial",
    types: COMMERCIAL,
    features: [
      "Shutter front",
      "Glass front",
      "Mezzanine floor",
      "Freight elevator",
      "Loading bay",
      "Conference room",
      "Separate washrooms",
      "Three phase electricity",
      "Industrial power",
      "Fire safety system",
      "Staff area",
      "Signboard space",
    ],
  },
];

/** The groups that apply to one property type. */
export function featureGroupsFor(type?: string): FeatureGroup[] {
  if (!type) return FEATURE_GROUPS.filter((group) => !group.types);

  const key = type as PropertyTypeKey;
  return FEATURE_GROUPS.filter(
    (group) => !group.types || group.types.includes(key),
  );
}

/** Every feature offered for a type, flattened — used to spot custom ones. */
export function knownFeaturesFor(type?: string): Set<string> {
  const all = new Set<string>();
  for (const group of featureGroupsFor(type)) {
    for (const feature of group.features) all.add(feature);
  }
  return all;
}

/** Every feature in the catalogue, whatever the type. */
export const ALL_KNOWN_FEATURES: Set<string> = new Set(
  FEATURE_GROUPS.flatMap((group) => group.features),
);
