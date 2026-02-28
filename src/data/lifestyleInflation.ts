// Lifestyle Inflation Database
// Real inflation rates for luxury items (2020-2026 averages)

export interface LifestyleItem {
  id: string;
  name: string;
  category: string;
  emoji: string;
  typicalCost: number; // in EUR
  inflationRate: number; // annual rate
  isRecurring: boolean;
  description: string;
}

export const lifestyleItems: LifestyleItem[] = [
  // SUPERCARS
  {
    id: 'porsche-911-turbo',
    name: 'Porsche 911 Turbo',
    category: 'supercars',
    emoji: '🏎️',
    typicalCost: 180000,
    inflationRate: 0.08,
    isRecurring: false,
    description: 'Iconic German sports car with turbo performance'
  },
  {
    id: 'ferrari-296-gtb',
    name: 'Ferrari 296 GTB',
    category: 'supercars',
    emoji: '🏎️',
    typicalCost: 280000,
    inflationRate: 0.10,
    isRecurring: false,
    description: 'Hybrid V6 supercar from Maranello'
  },
  {
    id: 'lamborghini-huracan',
    name: 'Lamborghini Huracán',
    category: 'supercars',
    emoji: '🏎️',
    typicalCost: 250000,
    inflationRate: 0.09,
    isRecurring: false,
    description: 'Italian V10 supercar'
  },
  {
    id: 'mclaren-720s',
    name: 'McLaren 720S',
    category: 'supercars',
    emoji: '🏎️',
    typicalCost: 300000,
    inflationRate: 0.09,
    isRecurring: false,
    description: 'British supercar with carbon fiber chassis'
  },

  // LUXURY CARS
  {
    id: 'mercedes-s-class',
    name: 'Mercedes S-Class',
    category: 'luxury-cars',
    emoji: '🚙',
    typicalCost: 120000,
    inflationRate: 0.07,
    isRecurring: false,
    description: 'Flagship luxury sedan from Mercedes-Benz'
  },
  {
    id: 'bmw-7-series',
    name: 'BMW 7 Series',
    category: 'luxury-cars',
    emoji: '🚙',
    typicalCost: 110000,
    inflationRate: 0.07,
    isRecurring: false,
    description: 'German luxury sedan with advanced tech'
  },
  {
    id: 'range-rover',
    name: 'Range Rover Autobiography',
    category: 'luxury-cars',
    emoji: '🚙',
    typicalCost: 140000,
    inflationRate: 0.08,
    isRecurring: false,
    description: 'British luxury SUV'
  },
  {
    id: 'bentley-continental',
    name: 'Bentley Continental GT',
    category: 'luxury-cars',
    emoji: '🚙',
    typicalCost: 220000,
    inflationRate: 0.08,
    isRecurring: false,
    description: 'British grand tourer with W12 engine'
  },

  // EDUCATION
  {
    id: 'uk-private-school',
    name: 'Private School (UK)',
    category: 'education',
    emoji: '🎓',
    typicalCost: 30000,
    inflationRate: 0.15,
    isRecurring: true,
    description: 'Annual boarding school fees at top UK institution'
  },
  {
    id: 'us-private-school',
    name: 'Private School (US)',
    category: 'education',
    emoji: '🎓',
    typicalCost: 35000,
    inflationRate: 0.14,
    isRecurring: true,
    description: 'Annual tuition at elite US prep school'
  },
  {
    id: 'swiss-boarding-school',
    name: 'Swiss Boarding School',
    category: 'education',
    emoji: '🎓',
    typicalCost: 85000,
    inflationRate: 0.12,
    isRecurring: true,
    description: 'Annual fees at prestigious Swiss boarding school'
  },
  {
    id: 'ivy-league-tuition',
    name: 'Ivy League University',
    category: 'education',
    emoji: '🎓',
    typicalCost: 60000,
    inflationRate: 0.13,
    isRecurring: true,
    description: 'Annual tuition at Harvard, Yale, Princeton, etc.'
  },
  {
    id: 'private-tutor',
    name: 'Private Tutor (Premium)',
    category: 'education',
    emoji: '🎓',
    typicalCost: 15000,
    inflationRate: 0.10,
    isRecurring: true,
    description: 'Annual cost for premium private tutoring'
  },

  // REAL ESTATE
  {
    id: 'london-prime-flat',
    name: 'Prime London Flat',
    category: 'real-estate',
    emoji: '🏠',
    typicalCost: 2000000,
    inflationRate: 0.07,
    isRecurring: false,
    description: '2-bed flat in Mayfair, Knightsbridge, or Chelsea'
  },
  {
    id: 'paris-apartment',
    name: 'Paris Apartment (6th)',
    category: 'real-estate',
    emoji: '🏠',
    typicalCost: 1500000,
    inflationRate: 0.08,
    isRecurring: false,
    description: 'Classic Haussmann apartment in 6th arrondissement'
  },
  {
    id: 'manhattan-condo',
    name: 'Manhattan Condo',
    category: 'real-estate',
    emoji: '🏠',
    typicalCost: 2500000,
    inflationRate: 0.09,
    isRecurring: false,
    description: '2-bed condo in Upper East Side or Tribeca'
  },
  {
    id: 'swiss-chalet',
    name: 'Swiss Alps Chalet',
    category: 'real-estate',
    emoji: '🏠',
    typicalCost: 3000000,
    inflationRate: 0.10,
    isRecurring: false,
    description: 'Ski chalet in Verbier or St. Moritz'
  },
  {
    id: 'monaco-apartment',
    name: 'Monaco Apartment',
    category: 'real-estate',
    emoji: '🏠',
    typicalCost: 5000000,
    inflationRate: 0.12,
    isRecurring: false,
    description: '2-bed apartment in Monte Carlo'
  },

  // WATCHES
  {
    id: 'rolex-submariner',
    name: 'Rolex Submariner',
    category: 'watches',
    emoji: '⌚',
    typicalCost: 10000,
    inflationRate: 0.10,
    isRecurring: false,
    description: 'Iconic diving watch, steel version'
  },
  {
    id: 'rolex-daytona',
    name: 'Rolex Daytona',
    category: 'watches',
    emoji: '⌚',
    typicalCost: 35000,
    inflationRate: 0.15,
    isRecurring: false,
    description: 'Legendary chronograph, high demand'
  },
  {
    id: 'patek-philippe-nautilus',
    name: 'Patek Philippe Nautilus',
    category: 'watches',
    emoji: '⌚',
    typicalCost: 80000,
    inflationRate: 0.20,
    isRecurring: false,
    description: 'Iconic sports watch, extremely sought after'
  },
  {
    id: 'audemars-piguet-royal-oak',
    name: 'Audemars Piguet Royal Oak',
    category: 'watches',
    emoji: '⌚',
    typicalCost: 60000,
    inflationRate: 0.18,
    isRecurring: false,
    description: 'Octagonal luxury sports watch'
  },
  {
    id: 'richard-mille',
    name: 'Richard Mille RM 11',
    category: 'watches',
    emoji: '⌚',
    typicalCost: 150000,
    inflationRate: 0.12,
    isRecurring: false,
    description: 'Ultra-luxury technical timepiece'
  },

  // TRAVEL
  {
    id: 'first-class-longhaul',
    name: 'First Class (Long-haul)',
    category: 'travel',
    emoji: '✈️',
    typicalCost: 8000,
    inflationRate: 0.12,
    isRecurring: true,
    description: 'Round-trip first class to Asia/Americas'
  },
  {
    id: 'private-jet-europe',
    name: 'Private Jet (Europe)',
    category: 'travel',
    emoji: '✈️',
    typicalCost: 25000,
    inflationRate: 0.15,
    isRecurring: true,
    description: 'Light jet charter within Europe'
  },
  {
    id: 'five-star-resort',
    name: 'Five-Star Resort (Week)',
    category: 'travel',
    emoji: '✈️',
    typicalCost: 15000,
    inflationRate: 0.10,
    isRecurring: true,
    description: 'Week at Maldives, Bora Bora, or similar'
  },
  {
    id: 'luxury-yacht-charter',
    name: 'Yacht Charter (Week)',
    category: 'travel',
    emoji: '✈️',
    typicalCost: 50000,
    inflationRate: 0.13,
    isRecurring: true,
    description: 'Weekly Mediterranean yacht charter'
  },

  // HEALTHCARE
  {
    id: 'private-health-insurance',
    name: 'Private Health Insurance',
    category: 'healthcare',
    emoji: '🏥',
    typicalCost: 8000,
    inflationRate: 0.12,
    isRecurring: true,
    description: 'Annual premium for comprehensive private coverage'
  },
  {
    id: 'plastic-surgery',
    name: 'Plastic Surgery',
    category: 'healthcare',
    emoji: '🏥',
    typicalCost: 15000,
    inflationRate: 0.10,
    isRecurring: false,
    description: 'Major cosmetic procedure'
  },
  {
    id: 'dental-implants',
    name: 'Dental Implants (Full)',
    category: 'healthcare',
    emoji: '🏥',
    typicalCost: 25000,
    inflationRate: 0.08,
    isRecurring: false,
    description: 'Complete dental restoration'
  },
  {
    id: 'concierge-doctor',
    name: 'Concierge Doctor',
    category: 'healthcare',
    emoji: '🏥',
    typicalCost: 12000,
    inflationRate: 0.11,
    isRecurring: true,
    description: 'Annual retainer for 24/7 private physician'
  },

  // SERVICES
  {
    id: 'live-in-nanny',
    name: 'Live-in Nanny',
    category: 'services',
    emoji: '👔',
    typicalCost: 45000,
    inflationRate: 0.12,
    isRecurring: true,
    description: 'Annual salary for experienced live-in childcare'
  },
  {
    id: 'private-chef',
    name: 'Private Chef',
    category: 'services',
    emoji: '👔',
    typicalCost: 60000,
    inflationRate: 0.10,
    isRecurring: true,
    description: 'Annual salary for personal chef'
  },
  {
    id: 'personal-trainer',
    name: 'Personal Trainer (Elite)',
    category: 'services',
    emoji: '👔',
    typicalCost: 20000,
    inflationRate: 0.09,
    isRecurring: true,
    description: 'Annual cost for premium personal training'
  },
  {
    id: 'chauffeur',
    name: 'Private Chauffeur',
    category: 'services',
    emoji: '👔',
    typicalCost: 50000,
    inflationRate: 0.11,
    isRecurring: true,
    description: 'Annual salary plus vehicle for full-time driver'
  },

  // LIFESTYLE
  {
    id: 'michelin-dining',
    name: 'Michelin Dining',
    category: 'lifestyle',
    emoji: '🍷',
    typicalCost: 5000,
    inflationRate: 0.12,
    isRecurring: true,
    description: 'Annual budget for 3-star Michelin restaurants'
  },
  {
    id: 'wine-collection',
    name: 'Fine Wine Collection',
    category: 'lifestyle',
    emoji: '🍷',
    typicalCost: 25000,
    inflationRate: 0.15,
    isRecurring: true,
    description: 'Annual investment in collectible wines'
  },
  {
    id: 'country-club',
    name: 'Country Club Membership',
    category: 'lifestyle',
    emoji: '🍷',
    typicalCost: 15000,
    inflationRate: 0.08,
    isRecurring: true,
    description: 'Annual dues at exclusive country club'
  },
  {
    id: 'luxury-fashion',
    name: 'Luxury Fashion Budget',
    category: 'lifestyle',
    emoji: '🍷',
    typicalCost: 30000,
    inflationRate: 0.10,
    isRecurring: true,
    description: 'Annual wardrobe from Hermès, Chanel, etc.'
  },

  // CULTURE
  {
    id: 'art-collection',
    name: 'Contemporary Art',
    category: 'culture',
    emoji: '🎨',
    typicalCost: 50000,
    inflationRate: 0.18,
    isRecurring: true,
    description: 'Annual art purchases from emerging/established artists'
  },
  {
    id: 'opera-season-tickets',
    name: 'Opera Season Tickets',
    category: 'culture',
    emoji: '🎨',
    typicalCost: 8000,
    inflationRate: 0.09,
    isRecurring: true,
    description: 'Premium box seats for full season'
  },
  {
    id: 'charity-gala-table',
    name: 'Charity Gala Table',
    category: 'culture',
    emoji: '🎨',
    typicalCost: 20000,
    inflationRate: 0.10,
    isRecurring: true,
    description: 'Table at major charity fundraising events'
  }
];

// Helper functions
export function getItemById(id: string): LifestyleItem | undefined {
  return lifestyleItems.find(item => item.id === id);
}

export function getItemsByCategory(category: string): LifestyleItem[] {
  return lifestyleItems.filter(item => item.category === category);
}

export function getAllCategories(): string[] {
  const categories = new Set(lifestyleItems.map(item => item.category));
  return Array.from(categories);
}

// Calculate future cost for an item
export function calculateFutureCost(
  currentCost: number,
  inflationRate: number,
  years: number
): number {
  return currentCost * Math.pow(1 + inflationRate, years);
}
