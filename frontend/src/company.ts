// All text on the public website comes from this file. Replace the placeholders with your real company details.
export const company = {
  name: 'CanTrack',
  legalName: 'Your Company Name AG', // TODO
  tagline: 'Every plant. Every position. Every move — traced.',
  intro:
    'CanTrack is a plant tracking and traceability platform for breeding glasshouses. Scan a QR code and the system knows which plant sits where, which genotype it carries and where it has been.',
  about: [
    'Breeding programmes live and die by data quality. When thousands of plants move between platforms and glasshouses, a clipboard and a spreadsheet are not enough.',
    'CanTrack gives every physical plant a unique ID and every glasshouse position a unique code. Gardeners scan both with a phone, breeders see results on a live map, and managers get reports without chasing anyone.',
  ],
  stats: [
    ['3', 'Glasshouses'],
    ['3,576', 'Trackable positions'],
    ['2 scans', 'To record a move'],
    ['Full', 'Audit trail'],
  ] as [string, string][],
  features: [
    { icon: '🏷️', title: 'Unique IDs & QR labels', text: 'Every plant and every position gets its own code. Print labels straight from the platform.' },
    { icon: '📱', title: 'Mobile scanning', text: 'Scan the position and the plant with the phone app. Mistakes are caught on the spot.' },
    { icon: '🗺️', title: 'Live glasshouse map', text: 'See what is where, platform by platform, and watch new scans appear as they happen.' },
    { icon: '🧬', title: 'Genotype traceability', text: 'Search by GID to find every physical plant, its location history and its parentage.' },
    { icon: '📑', title: 'Reports & exports', text: 'Occupancy, movements, turnover and scanning activity, exported to CSV or Excel.' },
    { icon: '🔒', title: 'Roles & audit trail', text: 'History cannot be edited or deleted. Every change records who did it and when.' },
  ],
  steps: [
    ['Label', 'Register plants and print QR labels for plants and glasshouse positions.'],
    ['Scan', 'Scan the position and the plant. The record is saved in seconds.'],
    ['Trace', 'Search, map and report on the full life of every plant.'],
  ] as [string, string][],
  facilities: [
    { code: 'L1', name: 'Glasshouse L1', text: 'Our largest glasshouse, laid out in platforms, columns and rows.' },
    { code: 'B2', name: 'Glasshouse B2', text: 'A compact glasshouse used for focused breeding work.' },
    { code: 'B3', name: 'Glasshouse B3', text: 'High-capacity glasshouse with six platforms.' },
  ],
  jobs: [] as { title: string; place: string; type: string }[], // e.g. { title: 'Glasshouse technician', place: 'Zurich', type: 'Full-time' }
  contact: {
    email: 'info@example.com',
    phone: '+00 00 000 00 00',
    address: ['Street 1', '0000 City', 'Country'],
    linkedin: '#',
  },
}
