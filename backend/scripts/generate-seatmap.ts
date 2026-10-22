/**
 * Generate a sample seat map JSON file with configurable seat count.
 * Usage: npx ts-node scripts/generate-seatmap.ts [totalSeats] [outputFile]
 * Default: 2000 seats -> prisma/sample-seatmap-2000.json
 */

const totalSeats = parseInt(process.argv[2] || '2000', 10);
const outputFile = process.argv[3] || `prisma/sample-seatmap-${totalSeats}.json`;

interface SeatDef {
  row: string;
  number: string;
  x: number;
  y: number;
}

interface SectionDef {
  name: string;
  nameVi: string;
  color: string;
  seats: SeatDef[];
}

const sections: SectionDef[] = [
  { name: 'VIP', nameVi: 'Khu VIP', color: '#FFD700', seats: [] },
  { name: 'Standard', nameVi: 'Khu Thường', color: '#4169E1', seats: [] },
  { name: 'Economy', nameVi: 'Khu Phổ Thông', color: '#32CD32', seats: [] },
];

// Allocate: 10% VIP, 40% Standard, 50% Economy
const vipCount = Math.floor(totalSeats * 0.1);
const standardCount = Math.floor(totalSeats * 0.4);
const economyCount = totalSeats - vipCount - standardCount;

const allocations = [vipCount, standardCount, economyCount];
const seatsPerRow = [10, 20, 25];
let currentRow = 0;

for (let s = 0; s < 3; s++) {
  const count = allocations[s];
  const perRow = seatsPerRow[s];
  const rows = Math.ceil(count / perRow);

  for (let r = 0; r < rows; r++) {
    const rowLetter = String.fromCharCode(65 + (currentRow % 26)) +
      (currentRow >= 26 ? String(Math.floor(currentRow / 26)) : '');
    const seatsInThisRow = Math.min(perRow, count - r * perRow);

    for (let n = 1; n <= seatsInThisRow; n++) {
      sections[s].seats.push({
        row: rowLetter,
        number: String(n),
        x: (n - 1) * 36,
        y: currentRow * 36,
      });
    }
    currentRow++;
  }
}

const totalGenerated = sections.reduce((sum, s) => sum + s.seats.length, 0);
const output = JSON.stringify({ sections }, null, 2);

const fs = require('fs');
const path = require('path');
fs.writeFileSync(path.resolve(__dirname, '..', outputFile), output);

console.log(`Generated seat map: ${totalGenerated} seats in ${outputFile}`);
console.log(`  VIP: ${sections[0].seats.length} seats`);
console.log(`  Standard: ${sections[1].seats.length} seats`);
console.log(`  Economy: ${sections[2].seats.length} seats`);
