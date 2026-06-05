 export type GeoFeature = null;

export type Area = {
  name: string;
  lat: number;
  lng: number;
  boundary: GeoFeature;
};

export type City = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
  areas: Area[];
};

export const CITIES: City[] = [
  {
    slug: "bahawalpur", name: "Bahawalpur", lat: 29.3956, lng: 71.6836, zoom: 12,
    areas: [
      { name: "DHA Bahawalpur",    lat: 29.3544, lng: 71.7356, boundary: null },
      { name: "Satellite Town",    lat: 29.3920, lng: 71.6712, boundary: null },
      { name: "Al-Rehman Garden",  lat: 29.4050, lng: 71.6580, boundary: null },
    ],
  },
  {
    slug: "burewala", name: "Burewala", lat: 30.1667, lng: 72.6667, zoom: 13,
    areas: [
      { name: "Citi Housing Burewala", lat: 30.1580, lng: 72.6450, boundary: null },
    ],
  },
  {
    slug: "dera-ghazi-khan", name: "Dera Ghazi Khan", lat: 30.0489, lng: 70.6335, zoom: 12,
    areas: [
      { name: "DHA D.G. Khan", lat: 30.0750, lng: 70.6050, boundary: null },
      { name: "Model Town",    lat: 30.0580, lng: 70.6420, boundary: null },
    ],
  },
  {
    slug: "faisalabad", name: "Faisalabad", lat: 31.4154, lng: 73.0875, zoom: 12,
    areas: [
      { name: "Wapda City",              lat: 31.4380, lng: 73.1180, boundary: null },
      { name: "Citi Housing Faisalabad", lat: 31.4720, lng: 73.0280, boundary: null },
    ],
  },
  {
    slug: "gujranwala", name: "Gujranwala", lat: 32.1877, lng: 74.1945, zoom: 12,
    areas: [
      { name: "DHA Gujranwala",          lat: 32.1550, lng: 74.2350, boundary: null },
      { name: "Citi Housing Gujranwala", lat: 32.2100, lng: 74.1650, boundary: null },
    ],
  },
  {
    slug: "hyderabad", name: "Hyderabad", lat: 25.3960, lng: 68.3578, zoom: 12,
    areas: [
      { name: "Gulistan-e-Sajjad",       lat: 25.4080, lng: 68.3720, boundary: null },
      { name: "Autobhan Housing Scheme", lat: 25.4350, lng: 68.3250, boundary: null },
    ],
  },
  {
    slug: "islamabad", name: "Islamabad", lat: 33.6844, lng: 73.0479, zoom: 12,
    areas: [
      { name: "DHA Islamabad",  lat: 33.4980, lng: 73.1550, boundary: null },
      { name: "Bahria Town",    lat: 33.5350, lng: 73.0850, boundary: null },
      { name: "Top City-1",     lat: 33.5480, lng: 72.9580, boundary: null },
      { name: "Gulberg Greens", lat: 33.6050, lng: 72.9780, boundary: null },
    ],
  },
  {
    slug: "karachi", name: "Karachi", lat: 24.8607, lng: 67.0011, zoom: 11,
    areas: [
      { name: "Bahria Town Karachi", lat: 24.8550, lng: 66.9750, boundary: null },
      { name: "DHA City Karachi",    lat: 24.7580, lng: 67.0950, boundary: null },
      { name: "Gulshan-e-Iqbal",     lat: 24.9200, lng: 67.1050, boundary: null },
    ],
  },
  {
    slug: "lahore", name: "Lahore", lat: 31.5204, lng: 74.3587, zoom: 11,
    areas: [
      { name: "DHA Lahore",         lat: 31.4720, lng: 74.4150, boundary: null },
      { name: "Bahria Town Lahore", lat: 31.3580, lng: 74.1750, boundary: null },
      { name: "Lake City",          lat: 31.5480, lng: 74.4680, boundary: null },
      { name: "Wapda Town",         lat: 31.4580, lng: 74.2820, boundary: null },
    ],
  },
  {
    slug: "multan", name: "Multan", lat: 30.1575, lng: 71.5249, zoom: 12,
    areas: [
      { name: "DHA Multan",         lat: 30.2150, lng: 71.4950, boundary: null },
      { name: "Royal Orchard",      lat: 30.1711, lng: 71.5151, boundary: null },
      { name: "Wapda Town",         lat: 30.1850, lng: 71.4780, boundary: null },
      { name: "Pearl City",         lat: 30.1480, lng: 71.5320, boundary: null },
    ],
  },
  {
    slug: "okara", name: "Okara", lat: 30.8138, lng: 73.4534, zoom: 13,
    areas: [
      { name: "Citi Housing Okara", lat: 30.8250, lng: 73.4380, boundary: null },
      { name: "Royal City",         lat: 30.8050, lng: 73.4650, boundary: null },
    ],
  },
  {
    slug: "peshawar", name: "Peshawar", lat: 34.0151, lng: 71.5249, zoom: 12,
    areas: [
      { name: "DHA Peshawar", lat: 33.9750, lng: 71.4520, boundary: null },
      { name: "Palm City",    lat: 33.9880, lng: 71.5180, boundary: null },
    ],
  },
  {
    slug: "quetta", name: "Quetta", lat: 30.1798, lng: 66.9750, zoom: 12,
    areas: [
      { name: "New Quetta City", lat: 30.1680, lng: 66.9850, boundary: null },
      { name: "Green Valley",    lat: 30.1950, lng: 67.0080, boundary: null },
      { name: "Royal Residency", lat: 30.1720, lng: 66.9620, boundary: null },
    ],
  },
  {
    slug: "rahim-yar-khan", name: "Rahim Yar Khan", lat: 28.4202, lng: 70.2952, zoom: 12,
    areas: [
      { name: "Al-Rehman Garden", lat: 28.4150, lng: 70.2880, boundary: null },
    ],
  },
  {
    slug: "rawalpindi", name: "Rawalpindi", lat: 33.5651, lng: 73.0169, zoom: 12,
    areas: [
      { name: "Bahria Town Rawalpindi", lat: 33.5280, lng: 72.9750, boundary: null },
      { name: "DHA Rawalpindi",         lat: 33.5180, lng: 73.1350, boundary: null },
    ],
  },
  {
    slug: "sialkot", name: "Sialkot", lat: 32.4945, lng: 74.5229, zoom: 12,
    areas: [
      { name: "Citi Housing Sialkot", lat: 32.4780, lng: 74.4980, boundary: null },
    ],
  },
];

export function getCityBySlug(slug: string): City | null {
  return CITIES.find((c) => c.slug === slug) ?? null;
}