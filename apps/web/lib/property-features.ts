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
 *
 * Wording is deliberately the Pakistani one rather than the textbook one —
 * "sui gas", "boring", "fard", "intiqal", "car porch", "west open". An agent
 * in Multan should recognise their own listing in this list, and a buyer
 * searching for "west open" should find the houses that are.
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
      "East open",
      "Back open",
      "Two side open",
      "Three side open",
      "Double unit",
      "Possession available",
      "Newly built",
      "Renovated",
      "Furnished",
      "Semi furnished",
      "Separate entrance",
      "Facing mosque",
      "Sun facing",
      "Wide street (40 ft+)",
      "Cul-de-sac / dead end street",
      "Near entrance gate",
      "Investment opportunity",
      "Ideal for overseas buyers",
    ],
  },
  {
    title: "Floors & layout",
    types: BUILT,
    features: [
      "Single storey",
      "Double storey",
      "Triple storey",
      "Ground floor",
      "First floor",
      "Top floor",
      "Ground + basement",
      "Ground portion only",
      "Upper portion only",
      "Separate portions (two families)",
      "Independent unit",
      "Open plan",
      "Corner unit",
    ],
  },
  {
    title: "Rooms",
    types: RESIDENTIAL,
    features: [
      "Drawing room",
      "Dining room",
      "TV lounge",
      "Lounge / sitting room",
      "Family lounge",
      "Guest room",
      "Study room",
      "Store room",
      "Powder room",
      "Servant quarter",
      "Maid room",
      "Laundry room",
      "Basement",
      "Attached bathrooms",
      "Master bedroom",
      "Built-in wardrobes",
      "Walk-in closet",
      "Roof access",
      "Room on roof",
      "Separate kitchen",
      "Open / American kitchen",
      "Dirty kitchen",
      "Two kitchens",
      "Prayer room",
    ],
  },
  {
    title: "Utilities",
    features: [
      "Electricity",
      "Sui gas",
      "Water supply",
      "Water tank",
      "Overhead tank",
      "Underground tank",
      "Boring / water pump",
      "Water filter plant",
      "Solar panels",
      "Solar net metering",
      "Generator",
      "UPS backup",
      "Standby electricity",
      "Three phase meter",
      "Separate meters",
      "Gas geyser",
      "Electric geyser",
      "Internet / fibre",
      "Sewerage",
      "Underground wiring",
      "Rain water drainage",
    ],
  },
  {
    title: "Finishing",
    types: BUILT,
    features: [
      "Marble flooring",
      "Imported marble",
      "Tile flooring",
      "Wooden flooring",
      "Chip / mosaic flooring",
      "False ceiling",
      "POP / gypsum ceiling",
      "Wood work",
      "Imported fittings",
      "Imported sanitary",
      "Kitchen cabinets",
      "Designer kitchen",
      "Double glazed windows",
      "uPVC windows",
      "Aluminium windows",
      "Glass railing",
      "Wooden doors",
      "Centrally air conditioned",
      "Air conditioning installed",
      "Heating / gas heaters",
      "Painted recently",
      "Grey structure",
    ],
  },
  {
    title: "Outside",
    features: [
      "Lawn / garden",
      "Kitchen garden",
      "Fruit trees",
      "Car porch",
      "Garage",
      "Parking space",
      "Parking for 2+ cars",
      "Driveway",
      "Terrace",
      "Rooftop sitting area",
      "Balcony",
      "Veranda",
      "Swimming pool",
      "Boundary wall",
      "Main gate",
      "Grill work",
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
      "Fire alarm",
      "Maintenance staff",
      "Service stairs",
      "Visitor parking",
      "Basement parking",
      "Community lawn",
      "Rooftop community area",
      "Children play area",
      "Gym",
      "Prayer area",
      "Mosque in building",
      "Water filtration plant",
      "Waste disposal",
      "Standby generator for common areas",
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
      "College / university nearby",
      "Hospital nearby",
      "Market / bazaar nearby",
      "Bank / ATM nearby",
      "Public transport nearby",
      "Metro / Orange Line nearby",
      "Main highway access",
      "Motorway interchange nearby",
      "Ring road nearby",
      "Airport nearby",
      "Railway station nearby",
      "Commercial area nearby",
      "Society maintenance",
      "Street lights",
      "Carpeted roads",
      "Developed sector",
      "Under-development sector",
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
      "Possession pending",
      "Utilities at site",
      "Ready for construction",
      "Agricultural land",
      "Residential plot",
      "Commercial plot",
      "Industrial plot",
      "Farmhouse plot",
      "Corner plot",
      "Boundary marked",
      "Clear ownership / fard",
      "Balloted",
      "Non-balloted file",
      "Transferable file",
      "Developed sector",
      "Filled plot",
      "Low lying plot",
      "Canal view",
    ],
  },
  {
    /*
     * Paperwork, which is where a Pakistani deal lives or dies.
     *
     * A buyer's first three questions are whether the title is clean, whether
     * the transfer can actually happen, and who the dues are with. Leaving
     * that to free text meant it mostly went unsaid — and the answer is a
     * fact about the property, not a selling line, so it belongs in a tick
     * box where it can be filtered on later.
     */
    title: "Ownership & papers",
    features: [
      "Clear title / fard available",
      "Registry done",
      "Intiqal / mutation done",
      "Transfer letter available",
      "Allotment letter available",
      "Transfer ready",
      "NOC approved",
      "Map approved by authority",
      "Non-encumbrance certificate",
      "Property tax paid",
      "Society dues cleared",
      "Single owner",
      "Inherited property",
      "Power of attorney",
      "Disputed / under litigation",
    ],
  },
  {
    title: "Payment & terms",
    features: [
      "Cash only",
      "Installments available",
      "Bank loan acceptable",
      "Exchange / adjustment considered",
      "Price negotiable",
      "Fixed price",
      "Advance required",
      "Rent negotiable",
      "Family only",
      "Bachelors allowed",
      "Short term rent",
      "Long term rent",
      "Maintenance included in rent",
      "Utilities separate",
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
      "Running business",
      "Food court / plaza",
      "Customer parking",
      "Warehouse / godown space",
      "Cold storage",
      "Boundary secured yard",
      "Office cabins",
      "Server / IT room",
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
