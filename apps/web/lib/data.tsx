export interface Property {
  id: string;
  name: string;
  slug: string;
  type: 'House' | 'Apartment' | 'Flat' | 'Commercial' | 'Office' | 'Plot' | 'Land' | 'Shop' | 'Factory' | 'Hotel' | 'Restaurant' | 'Other';
  city: string;
  citySlug?: string;
  location: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  area: number;
  areaSlug?: string;
  marla?: number;
  kenal?: number;
  purpose: 'rent' | 'buy';
  image: string;
  featured?: boolean;
  description?: string;
  features?: string[];
  areaId?: string; // Area ObjectId
  areaName?: string; // Area name
  longitude?: number;
  latitude?: number;
  whatsappNumber?: string;
  contactNumber?: string;
  videoUrl?: string | null;
}

export interface Hotel {
  id: string;
  name: string;
  city: string;
  location: string;
  price: number;
  rating: number;
  rooms: number;
  description: string;
  amenities: string[];
  image: string;
}

export const properties: Property[] = [
  // MULTAN PROPERTIES (Rent)
  {
    id: '1',
    name: "Modern Villa with Garden",
    type: "House",
    slug: "modern-villa-with-garden",
    city: "Multan",
    location: "Bosan Road",
    price: 45000,
    bedrooms: 4,
    bathrooms: 3,
    area: 2500,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80",
    featured: true,
    description: "Beautiful modern villa with spacious garden and parking"
  },
  {
    id: '5',
    name: "Studio Flat",
    type: "Flat",
    city: "Multan",
    slug: "studio-flat",
    location: "Gulgasht Colony",
    price: 18000,
    bedrooms: 1,
    bathrooms: 1,
    area: 600,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80",
    featured: true,
    description: "Cozy studio flat perfect for singles or couples"
  },
  {
    id: '9',
    name: "Family Apartment",
    type: "Apartment",
    city: "Multan",
    location: "Cantt",
    slug: "family-apartment",
    price: 35000,
    bedrooms: 3,
    bathrooms: 2,
    area: 1500,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
    description: "Spacious apartment in peaceful cantonment area"
  },
  {
    id: '10',
    name: "Commercial Shop",
    type: "Commercial",
    city: "Multan",
    location: "Chungi No. 9",
    price: 55000,
    slug: "commercial-shop",
    bedrooms: 0,
    bathrooms: 2,
    area: 800,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
    description: "Prime location shop for retail business"
  },
  {
    id: '11',
    name: "Luxury House",
    slug: "luxury-house",
    type: "House",
    city: "Multan",
    location: "DHA",
    price: 75000,
    bedrooms: 5,
    bathrooms: 4,
    area: 3000,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80",
    description: "Premium house in DHA with modern amenities"
  },
  {
    id: '12',
    name: "Bachelor Flat",
    type: "Flat",
    slug: "bachelor-flat",
    city: "Multan",
    location: "Shah Rukn-e-Alam",
    price: 15000,
    bedrooms: 1,
    bathrooms: 1,
    area: 500,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80",
    description: "Affordable flat near main city area"
  },

  // MULTAN PROPERTIES (Buy)
  {
    id: '13',
    name: "New Construction House",
    type: "House",
    slug: "new-construction-house",
    city: "Multan",
    location: "Bahauddin Zakariya University Road",
    price: 12500000,
    bedrooms: 4,
    bathrooms: 3,
    area: 2200,
    purpose: "buy",
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80",
    description: "Brand new construction with modern design"
  },
  {
    id: '14',
    name: "Investment Apartment",
    type: "Apartment",
    slug: "investment-apartment",
    city: "Multan",
    location: "New Multan",
    price: 8500000,
    bedrooms: 3,
    bathrooms: 2,
    area: 1400,
    purpose: "buy",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",
    description: "Great investment opportunity in developing area"
  },

  // LAHORE PROPERTIES (Rent)
  {
    id: '15',
    name: "Modern Penthouse",
    type: "Apartment",
    slug: "modern-penthouse",
    city: "Lahore",
    location: "DHA Phase 5",
    price: 95000,
    bedrooms: 4,
    bathrooms: 3,
    area: 2500,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
    description: "Luxurious penthouse with city views"
  },
  {
    id: '16',
    name: "Student Accommodation",
    type: "Flat",
    slug: "student-accommodation",
    city: "Lahore",
    location: "Johar Town",
    price: 22000,
    bedrooms: 2,
    bathrooms: 1,
    area: 900,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
    description: "Affordable flat near universities"
  },
  {
    id: '17',
    name: "Office Space",
    type: "Commercial",
    slug: "office-space",
    city: "Lahore",
    location: "MM Alam Road",
    price: 120000,
    bedrooms: 0,
    bathrooms: 3,
    area: 2000,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80",
    description: "Premium office space in business district"
  },
  {
    id: '18',
    name: "Family Villa",
    type: "House",
    slug: "family-villa",
    city: "Lahore",
    location: "Model Town",
    price: 85000,
    bedrooms: 5,
    bathrooms: 4,
    area: 3500,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
    description: "Spacious villa in prestigious neighborhood"
  },

  // LAHORE PROPERTIES (Buy)
  {
    id: '2',
    name: "Luxury Apartment",
    type: "Apartment",
    slug: "luxury-apartment",
    city: "Lahore",
    location: "DHA Phase 5",
    price: 35000000,
    bedrooms: 3,
    bathrooms: 2,
    area: 1800,
    purpose: "buy",
    image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
    featured: true,
    description: "Premium apartment in prime DHA location"
  },
  {
    id: '6',
    name: "Executive Bungalow",
    type: "House",
    slug: "executive-bungalow",
    city: "Lahore",
    location: "Gulberg III",
    price: 75000000,
    bedrooms: 6,
    bathrooms: 5,
    area: 4500,
    purpose: "buy",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
    featured: true,
    description: "Elegant bungalow with premium finishes"
  },
  {
    id: '19',
    name: "Investment Flat",
    type: "Flat",
    slug: "investment-flat",
    city: "Lahore",
    location: "Bahria Town",
    price: 9500000,
    bedrooms: 2,
    bathrooms: 2,
    area: 1100,
    purpose: "buy",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
    description: "Ready to move flat in gated community"
  },
  {
    id: '20',
    name: "Commercial Plaza",
    type: "Commercial",
    slug: "commercial-plaza",
    city: "Lahore",
    location: "Main Boulevard Gulberg",
    price: 95000000,
    bedrooms: 0,
    bathrooms: 8,
    area: 6000,
    purpose: "buy",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80",
    description: "Multi-story commercial building with high ROI"
  },

  // ISLAMABAD PROPERTIES (Rent)
  {
    id: '3',
    name: "Cozy Family Home",
    type: "House",
    slug: "cozy-family-home",
    city: "Islamabad",
    location: "F-10",
    price: 85000,
    bedrooms: 5,
    bathrooms: 4,
    area: 3200,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
    featured: true,
    description: "Beautiful home in peaceful F-sector"
  },
  {
    id: '8',
    name: "Budget Friendly Flat",
    type: "Flat",
    slug: "budget-friendly-flat",
    city: "Islamabad",
    location: "G-11",
    price: 25000,
    bedrooms: 2,
    bathrooms: 1,
    area: 900,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800&q=80",
    description: "Affordable option in developed sector"
  },
  {
    id: '21',
    name: "Diplomatic Enclave Apartment",
    type: "Apartment",
    slug: "diplomatic-enclave-apartment",
    city: "Islamabad",
    location: "F-7",
    price: 70000,
    bedrooms: 3,
    bathrooms: 2,
    area: 1800,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
    description: "High-end apartment in diplomatic area"
  },
  {
    id: '22',
    name: "Corporate Office",
    type: "Commercial",
    slug: "corporate-office",
    city: "Islamabad",
    location: "Blue Area",
    price: 150000,
    bedrooms: 0,
    bathrooms: 4,
    area: 2500,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&q=80",
    description: "Premium office space in business hub"
  },
  {
    id: '23',
    name: "Mountain View Villa",
    type: "House",
    slug: "mountain-view-villa",
    city: "Islamabad",
    location: "E-11",
    price: 95000,
    bedrooms: 4,
    bathrooms: 3,
    area: 2800,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=80",
    description: "Stunning views of Margalla Hills"
  },

  // ISLAMABAD PROPERTIES (Buy)
  {
    id: '24',
    name: "Luxury Mansion",
    type: "House",
    slug: "luxury-mansion",
    city: "Islamabad",
    location: "F-6",
    price: 125000000,
    bedrooms: 7,
    bathrooms: 6,
    area: 5500,
    purpose: "buy",
    image: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&q=80",
    description: "Ultra-luxury mansion in prime location"
  },
  {
    id: '25',
    name: "Modern Apartment Complex",
    type: "Apartment",
    slug: "modern-apartment-complex",
    city: "Islamabad",
    location: "G-13",
    price: 15000000,
    bedrooms: 3,
    bathrooms: 2,
    area: 1600,
    purpose: "buy",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
    description: "Brand new apartment with all facilities"
  },

  // KARACHI PROPERTIES (Rent)
  {
    id: '4',
    name: "Commercial Plaza",
    type: "Commercial",
    slug: "commercial-plaza",
    city: "Karachi",
    location: "Clifton",
    price: 150000,
    bedrooms: 0,
    bathrooms: 4,
    area: 5000,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80",
    featured: true,
    description: "Prime commercial space near beach"
  },
  {
    id: '7',
    name: "Modern Penthouse",
    type: "Apartment",
    slug: "modern-penthouse",
    city: "Karachi",
    location: "Bahria Town",
    price: 120000,
    bedrooms: 4,
    bathrooms: 3,
    area: 2800,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
    description: "Luxurious penthouse with modern amenities"
  },
  {
    id: '26',
    name: "Sea View Apartment",
    type: "Apartment",
    slug: "sea-view-apartment",
    city: "Karachi",
    location: "DHA Phase 8",
    price: 85000,
    bedrooms: 3,
    bathrooms: 2,
    area: 2000,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",
    description: "Beautiful sea views from every room"
  },
  {
    id: '27',
    name: "Budget Flat",
    type: "Flat",
    slug: "budget-flat",
    city: "Karachi",
    location: "Gulshan-e-Iqbal",
    price: 28000,
    bedrooms: 2,
    bathrooms: 1,
    area: 1000,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
    description: "Affordable living in central location"
  },
  {
    id: '28',
    name: "Premium Office Space",
    type: "Office",
    slug: "premium-office-space",
    city: "Karachi",
    location: "SITE Area",
    price: 200000,
    bedrooms: 0,
    bathrooms: 2,
    area: 8000,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&q=80",
    description: "Large modern office space in prime industrial area"
  },
  {
    id: '29',
    name: "Beach House",
    type: "House",
    slug: "beach-house",
    city: "Karachi",
    location: "Hawksbay",
    price: 110000,
    bedrooms: 4,
    bathrooms: 3,
    area: 3000,
    purpose: "rent",
    image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80",
    description: "Stunning beach house for vacation or living"
  },

  // KARACHI PROPERTIES (Buy)
  {
    id: '30',
    name: "DHA Villa",
    type: "House",
    slug: "dha-villa",
    city: "Karachi",
    location: "DHA Phase 6",
    price: 85000000,
    bedrooms: 5,
    bathrooms: 4,
    area: 4000,
    purpose: "buy",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
    description: "Magnificent villa in prestigious DHA"
  },
  {
    id: '31',
    name: "Investment Flat",
    type: "Flat",
    slug: "investment-flat",
    city: "Karachi",
    location: "Bahria Town",
    price: 11000000,
    bedrooms: 2,
    bathrooms: 2,
    area: 1200,
    purpose: "buy",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
    description: "Ready possession flat with parking"
  },
  {
    id: '32',
    name: "Shopping Complex",
    type: "Commercial",
    slug: "shopping-complex",
    city: "Karachi",
    location: "Saddar",
    price: 120000000,
    bedrooms: 0,
    bathrooms: 10,
    area: 10000,
    purpose: "buy",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
    description: "Complete shopping complex in busy market"
  }
];

export const hotels: Hotel[] = [
  {
    id: '1',
    name: "Pearl Continental Multan",
    city: "Multan",
    location: "Khanewal Road",
    price: 15000,
    rating: 4.5,
    rooms: 150,
    description: "Experience luxury and comfort at the heart of Multan with world-class amenities and exceptional service.",
    amenities: ["WiFi", "Pool", "Spa", "Restaurant", "Gym", "Parking"],
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80"
  },
  {
    id: '2',
    name: "Serena Hotel",
    city: "Islamabad",
    location: "Constitution Avenue",
    price: 28000,
    rating: 4.8,
    rooms: 200,
    description: "A premium 5-star hotel offering unparalleled luxury in the capital city with stunning mountain views.",
    amenities: ["WiFi", "Pool", "Spa", "Restaurant", "Gym", "Business Center"],
    image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80"
  },
  {
    id: '3',
    name: "Movenpick Hotel",
    city: "Karachi",
    location: "Club Road",
    price: 22000,
    rating: 4.6,
    rooms: 180,
    description: "Swiss hospitality meets Pakistani warmth in this elegant hotel near the Arabian Sea.",
    amenities: ["WiFi", "Pool", "Restaurant", "Bar", "Gym", "Conference"],
    image: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80"
  },
  {
    id: '4',
    name: "Avari Hotel",
    city: "Lahore",
    location: "Mall Road",
    price: 18000,
    rating: 4.4,
    rooms: 160,
    description: "A heritage hotel blending Mughal architecture with modern amenities in historic Lahore.",
    amenities: ["WiFi", "Pool", "Restaurant", "Gym", "Parking", "Lounge"],
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80"
  },
  {
    id: '5',
    name: "Ramada Multan",
    city: "Multan",
    location: "Abdali Road",
    price: 12000,
    rating: 4.2,
    rooms: 100,
    description: "Comfortable stay with modern facilities in the city center.",
    amenities: ["WiFi", "Restaurant", "Gym", "Parking", "Room Service"],
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80"
  },
  {
    id: '6',
    name: "Marriott Hotel Islamabad",
    city: "Islamabad",
    location: "Aga Khan Road",
    price: 32000,
    rating: 4.7,
    rooms: 250,
    description: "International luxury brand offering world-class service and amenities.",
    amenities: ["WiFi", "Pool", "Spa", "Multiple Restaurants", "Gym", "Business Center", "Ballroom"],
    image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80"
  },
  {
    id: '7',
    name: "Pearl Continental Karachi",
    city: "Karachi",
    location: "Club Road",
    price: 20000,
    rating: 4.5,
    rooms: 300,
    description: "Iconic hotel offering stunning sea views and premium facilities.",
    amenities: ["WiFi", "Pool", "Spa", "Restaurant", "Gym", "Sea View", "Conference"],
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80"
  },
  {
    id: '8',
    name: "Nishat Hotel Lahore",
    city: "Lahore",
    location: "Gulberg",
    price: 16000,
    rating: 4.3,
    rooms: 140,
    description: "Elegant hotel in the heart of Lahore's commercial district.",
    amenities: ["WiFi", "Pool", "Restaurant", "Gym", "Parking", "Conference"],
    image: "https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&q=80"
  }
];

export const cities = ['Multan', 'Lahore', 'Karachi', 'Islamabad'] as const;
export const propertyTypes = ['House', 'Apartment', 'Flat', 'Commercial', 'Office', 'Plot', 'Land', 'Shop', 'Factory', 'Hotel', 'Restaurant', 'Other'] as const;