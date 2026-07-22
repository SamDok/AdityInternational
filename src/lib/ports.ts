// Curated list of major container / export ports worldwide, tagged by country.
// Used to *suggest* destination ports based on the chosen country — the field
// still accepts any free-text value, so an unusual routing is never blocked.

export type Port = { name: string; country: string };

export const PORTS: Port[] = [
  // United States
  { name: "New York/New Jersey", country: "United States" },
  { name: "Los Angeles", country: "United States" },
  { name: "Long Beach", country: "United States" },
  { name: "Savannah", country: "United States" },
  { name: "Houston", country: "United States" },
  { name: "Norfolk", country: "United States" },
  { name: "Charleston", country: "United States" },
  { name: "Oakland", country: "United States" },
  { name: "Seattle", country: "United States" },
  { name: "Miami", country: "United States" },
  // Canada
  { name: "Vancouver", country: "Canada" },
  { name: "Montreal", country: "Canada" },
  { name: "Prince Rupert", country: "Canada" },
  // United Kingdom
  { name: "Felixstowe", country: "United Kingdom" },
  { name: "Southampton", country: "United Kingdom" },
  { name: "London Gateway", country: "United Kingdom" },
  { name: "Liverpool", country: "United Kingdom" },
  // Germany
  { name: "Hamburg", country: "Germany" },
  { name: "Bremerhaven", country: "Germany" },
  { name: "Wilhelmshaven", country: "Germany" },
  // Netherlands
  { name: "Rotterdam", country: "Netherlands" },
  { name: "Amsterdam", country: "Netherlands" },
  // Belgium
  { name: "Antwerp", country: "Belgium" },
  { name: "Zeebrugge", country: "Belgium" },
  // France
  { name: "Le Havre", country: "France" },
  { name: "Marseille", country: "France" },
  { name: "Fos-sur-Mer", country: "France" },
  // Spain
  { name: "Valencia", country: "Spain" },
  { name: "Algeciras", country: "Spain" },
  { name: "Barcelona", country: "Spain" },
  // Italy
  { name: "Genoa", country: "Italy" },
  { name: "Gioia Tauro", country: "Italy" },
  { name: "La Spezia", country: "Italy" },
  // Portugal
  { name: "Lisbon", country: "Portugal" },
  { name: "Sines", country: "Portugal" },
  // Greece
  { name: "Piraeus", country: "Greece" },
  // Ireland
  { name: "Dublin", country: "Ireland" },
  // Nordics
  { name: "Gothenburg", country: "Sweden" },
  { name: "Aarhus", country: "Denmark" },
  { name: "Oslo", country: "Norway" },
  { name: "Helsinki", country: "Finland" },
  // Poland / Baltics
  { name: "Gdansk", country: "Poland" },
  { name: "Gdynia", country: "Poland" },
  // Russia / Turkey
  { name: "St. Petersburg", country: "Russia" },
  { name: "Novorossiysk", country: "Russia" },
  { name: "Istanbul (Ambarli)", country: "Turkey" },
  { name: "Mersin", country: "Turkey" },
  { name: "Izmir", country: "Turkey" },
  // Middle East
  { name: "Jebel Ali (Dubai)", country: "United Arab Emirates" },
  { name: "Abu Dhabi (Khalifa)", country: "United Arab Emirates" },
  { name: "Sharjah", country: "United Arab Emirates" },
  { name: "Dammam", country: "Saudi Arabia" },
  { name: "Jeddah", country: "Saudi Arabia" },
  { name: "Hamad (Doha)", country: "Qatar" },
  { name: "Shuwaikh", country: "Kuwait" },
  { name: "Salalah", country: "Oman" },
  { name: "Sohar", country: "Oman" },
  { name: "Bahrain (Khalifa Bin Salman)", country: "Bahrain" },
  { name: "Aqaba", country: "Jordan" },
  { name: "Beirut", country: "Lebanon" },
  { name: "Haifa", country: "Israel" },
  { name: "Ashdod", country: "Israel" },
  // Egypt / Africa
  { name: "Alexandria", country: "Egypt" },
  { name: "Port Said", country: "Egypt" },
  { name: "Damietta", country: "Egypt" },
  { name: "Casablanca", country: "Morocco" },
  { name: "Tanger Med", country: "Morocco" },
  { name: "Durban", country: "South Africa" },
  { name: "Cape Town", country: "South Africa" },
  { name: "Mombasa", country: "Kenya" },
  { name: "Dar es Salaam", country: "Tanzania" },
  { name: "Lagos (Apapa)", country: "Nigeria" },
  { name: "Tema", country: "Ghana" },
  { name: "Djibouti", country: "Djibouti" },
  // South Asia
  { name: "Nhava Sheva (JNPT)", country: "India" },
  { name: "Mundra", country: "India" },
  { name: "Chennai", country: "India" },
  { name: "Kolkata", country: "India" },
  { name: "Cochin", country: "India" },
  { name: "Colombo", country: "Sri Lanka" },
  { name: "Chittagong", country: "Bangladesh" },
  { name: "Karachi", country: "Pakistan" },
  { name: "Port Qasim", country: "Pakistan" },
  // East / SE Asia
  { name: "Shanghai", country: "China" },
  { name: "Ningbo-Zhoushan", country: "China" },
  { name: "Shenzhen", country: "China" },
  { name: "Guangzhou", country: "China" },
  { name: "Qingdao", country: "China" },
  { name: "Tianjin", country: "China" },
  { name: "Xiamen", country: "China" },
  { name: "Hong Kong", country: "Hong Kong" },
  { name: "Kaohsiung", country: "Taiwan" },
  { name: "Keelung", country: "Taiwan" },
  { name: "Busan", country: "South Korea" },
  { name: "Incheon", country: "South Korea" },
  { name: "Tokyo", country: "Japan" },
  { name: "Yokohama", country: "Japan" },
  { name: "Kobe", country: "Japan" },
  { name: "Nagoya", country: "Japan" },
  { name: "Singapore", country: "Singapore" },
  { name: "Port Klang", country: "Malaysia" },
  { name: "Tanjung Pelepas", country: "Malaysia" },
  { name: "Laem Chabang", country: "Thailand" },
  { name: "Bangkok", country: "Thailand" },
  { name: "Ho Chi Minh City (Cat Lai)", country: "Vietnam" },
  { name: "Hai Phong", country: "Vietnam" },
  { name: "Tanjung Priok (Jakarta)", country: "Indonesia" },
  { name: "Manila", country: "Philippines" },
  // Oceania
  { name: "Sydney (Port Botany)", country: "Australia" },
  { name: "Melbourne", country: "Australia" },
  { name: "Brisbane", country: "Australia" },
  { name: "Fremantle", country: "Australia" },
  { name: "Auckland", country: "New Zealand" },
  // Latin America
  { name: "Santos", country: "Brazil" },
  { name: "Manzanillo", country: "Mexico" },
  { name: "Veracruz", country: "Mexico" },
  { name: "Buenos Aires", country: "Argentina" },
  { name: "Callao", country: "Peru" },
  { name: "Cartagena", country: "Colombia" },
  { name: "Balboa", country: "Panama" },
  { name: "San Antonio", country: "Chile" },
];

// The most common global hubs — shown when no country is picked yet, or when
// the chosen country has no port in our list.
const GLOBAL_HUBS = [
  "Nhava Sheva (JNPT)", "Mundra", "Jebel Ali (Dubai)", "Singapore", "Rotterdam",
  "Hamburg", "Antwerp", "New York/New Jersey", "Los Angeles", "Shanghai",
  "Felixstowe", "Colombo",
];

// Returns the port names to suggest for a given country. Falls back to global
// hubs when the country is empty or unknown. Never restricts free-text entry.
export function portsForCountry(country?: string | null): string[] {
  const c = (country ?? "").trim().toLowerCase();
  if (c) {
    const matches = PORTS.filter((p) => p.country.toLowerCase() === c).map((p) => p.name);
    if (matches.length > 0) return matches;
  }
  return GLOBAL_HUBS;
}
