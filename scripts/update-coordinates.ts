// import { readFileSync, writeFileSync } from "fs";
// import { join } from "path";

// interface Venue {
//   slug: string;
//   name: string;
//   address: string;
//   latitude: number;
//   longitude: number;
//   [key: string]: unknown;
// }

// interface GeocodeResult {
//   lat: string;
//   lon: string;
//   display_name: string;
// }

// /**
//  * Geocode an address using OpenStreetMap Nominatim API
//  * Rate limit: 1 request per second (we'll add delays)
//  */
// async function geocodeAddress(address: string): Promise<{
//   lat: number;
//   lon: number;
// } | null> {
//   try {
//     // Encode the address for the API
//     const encodedAddress = encodeURIComponent(address);
//     const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=fi`;

//     const response = await fetch(url, {
//       headers: {
//         "User-Agent": "WoltAdvisor-Geocoding-Script/1.0", // Required by Nominatim
//       },
//     });

//     if (!response.ok) {
//       console.error(`HTTP error! status: ${response.status}`);
//       return null;
//     }

//     const data = (await response.json()) as GeocodeResult[];

//     if (data.length === 0) {
//       console.warn(`No results found for: ${address}`);
//       return null;
//     }

//     const result = data[0];
//     return {
//       lat: parseFloat(result.lat),
//       lon: parseFloat(result.lon),
//     };
//   } catch (error) {
//     console.error(`Error geocoding ${address}:`, error);
//     return null;
//   }
// }

// /**
//  * Update coordinates in the espoo.json file
//  */
// async function updateCoordinates() {
//   const filePath = join(process.cwd(), "data", "infrastructure", "espoo.json");
//   const fileContent = readFileSync(filePath, "utf-8");
//   const venues = JSON.parse(fileContent) as Venue[];

//   console.log(`Found ${venues.length} venues to update\n`);

//   const updatedVenues: Venue[] = [];
//   let successCount = 0;
//   let failCount = 0;

//   for (let i = 0; i < venues.length; i++) {
//     const venue = venues[i];
//     const address = venue.address;

//     console.log(
//       `[${i + 1}/${venues.length}] Geocoding: ${venue.name} - ${address}`
//     );

//     const coordinates = await geocodeAddress(address);

//     if (coordinates) {
//       const oldLat = venue.latitude;
//       const oldLon = venue.longitude;
//       const newLat = coordinates.lat;
//       const newLon = coordinates.lon;

//       venue.latitude = newLat;
//       venue.longitude = newLon;

//       const latDiff = Math.abs(newLat - oldLat);
//       const lonDiff = Math.abs(newLon - oldLon);

//       console.log(
//         `  ✓ Updated: ${oldLat}, ${oldLon} → ${newLat}, ${newLon} (Δ: ${latDiff.toFixed(4)}, ${lonDiff.toFixed(4)})`
//       );

//       successCount++;
//     } else {
//       console.log(`  ✗ Failed to geocode, keeping original coordinates`);
//       failCount++;
//     }

//     updatedVenues.push(venue);

//     // Rate limiting: Nominatim requires max 1 request per second
//     // Add a 1.2 second delay between requests to be safe
//     if (i < venues.length - 1) {
//       await new Promise((resolve) => setTimeout(resolve, 1200));
//     }
//   }

//   // Write updated data back to file
//   writeFileSync(filePath, JSON.stringify(updatedVenues, null, 2) + "\n");

//   console.log(`\n=== Summary ===`);
//   console.log(`Total venues: ${venues.length}`);
//   console.log(`Successfully updated: ${successCount}`);
//   console.log(`Failed: ${failCount}`);
//   console.log(`\nUpdated file saved to: ${filePath}`);
// }

// // Run the script
// updateCoordinates().catch((error) => {
//   console.error("Fatal error:", error);
//   process.exit(1);
// });
