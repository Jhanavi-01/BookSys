import { PrismaClient, Role, EventStatus, SaleStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.entryScan.deleteMany();
  await prisma.scanSession.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.paymentAttempt.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.order.deleteMany();
  await prisma.seatHold.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.seatCategory.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.consentRecord.deleteMany();
  await prisma.waitingRoom.deleteMany();
  await prisma.showtime.deleteMany();
  await prisma.section.deleteMany();
  await prisma.event.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();

  // Create users (one per role)
  const defaultPassword = await hashPassword('Password123!');

  const admin = await prisma.user.create({
    data: {
      email: 'admin@ticketbooking.vn',
      passwordHash: defaultPassword,
      firstName: 'Nguyen',
      lastName: 'Admin',
      role: Role.ADMIN,
      emailVerified: true,
      preferredLanguage: 'vi',
      consentVersion: '1.0',
      consentAt: new Date(),
    },
  });

  const organizer = await prisma.user.create({
    data: {
      email: 'organizer@ticketbooking.vn',
      passwordHash: defaultPassword,
      firstName: 'Tran',
      lastName: 'Organizer',
      role: Role.ORGANIZER,
      emailVerified: true,
      preferredLanguage: 'vi',
      consentVersion: '1.0',
      consentAt: new Date(),
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: 'customer@ticketbooking.vn',
      passwordHash: defaultPassword,
      firstName: 'Le',
      lastName: 'Customer',
      role: Role.CUSTOMER,
      emailVerified: true,
      preferredLanguage: 'vi',
      consentVersion: '1.0',
      consentAt: new Date(),
    },
  });

  const entryStaff = await prisma.user.create({
    data: {
      email: 'staff@ticketbooking.vn',
      passwordHash: defaultPassword,
      firstName: 'Pham',
      lastName: 'Staff',
      role: Role.ENTRY_STAFF,
      emailVerified: true,
      preferredLanguage: 'vi',
      consentVersion: '1.0',
      consentAt: new Date(),
    },
  });

  const accountant = await prisma.user.create({
    data: {
      email: 'accountant@ticketbooking.vn',
      passwordHash: defaultPassword,
      firstName: 'Vo',
      lastName: 'Accountant',
      role: Role.ACCOUNTANT,
      emailVerified: true,
      preferredLanguage: 'vi',
      consentVersion: '1.0',
      consentAt: new Date(),
    },
  });

  console.log('Users created');

  // Create venues
  const venue1 = await prisma.venue.create({
    data: {
      name: 'Saigon Opera House',
      nameVi: 'Nha hat Thanh pho Ho Chi Minh',
      address: '7 Cong Truong Lam Son, Ben Nghe, Quan 1',
      city: 'Ho Chi Minh City',
      capacity: 500,
    },
  });

  const venue2 = await prisma.venue.create({
    data: {
      name: 'Hanoi National Convention Center',
      nameVi: 'Trung tam Hoi nghi Quoc gia',
      address: 'Me Tri, Tu Liem',
      city: 'Ha Noi',
      capacity: 3000,
    },
  });

  console.log('Venues created');

  // Create sections for venue 1
  const v1SectionVIP = await prisma.section.create({
    data: {
      venueId: venue1.id,
      name: 'VIP Section',
      nameVi: 'Khu VIP',
      sortOrder: 1,
      isGeneralAdmission: false,
      layoutData: {
        type: 'seated',
        rows: 5,
        seatsPerRow: 10,
        startX: 0,
        startY: 0,
        seatWidth: 40,
        seatHeight: 40,
        rowGap: 10,
        seatGap: 5,
      },
    },
  });

  const v1SectionStandard = await prisma.section.create({
    data: {
      venueId: venue1.id,
      name: 'Standard Section',
      nameVi: 'Khu Thuong',
      sortOrder: 2,
      isGeneralAdmission: false,
      layoutData: {
        type: 'seated',
        rows: 10,
        seatsPerRow: 20,
        startX: 0,
        startY: 300,
        seatWidth: 35,
        seatHeight: 35,
        rowGap: 8,
        seatGap: 4,
      },
    },
  });

  // Create sections for venue 2
  const v2SectionFloor = await prisma.section.create({
    data: {
      venueId: venue2.id,
      name: 'Floor Standing',
      nameVi: 'San dung',
      sortOrder: 1,
      isGeneralAdmission: true,
      layoutData: {
        type: 'general_admission',
        capacity: 1000,
      },
    },
  });

  const v2SectionA = await prisma.section.create({
    data: {
      venueId: venue2.id,
      name: 'Section A - Premium',
      nameVi: 'Khu A - Cao cap',
      sortOrder: 2,
      isGeneralAdmission: false,
      layoutData: {
        type: 'seated',
        rows: 15,
        seatsPerRow: 30,
        startX: 0,
        startY: 0,
        seatWidth: 30,
        seatHeight: 30,
        rowGap: 8,
        seatGap: 3,
      },
    },
  });

  const v2SectionB = await prisma.section.create({
    data: {
      venueId: venue2.id,
      name: 'Section B - Standard',
      nameVi: 'Khu B - Thuong',
      sortOrder: 3,
      isGeneralAdmission: false,
      layoutData: {
        type: 'seated',
        rows: 20,
        seatsPerRow: 40,
        startX: 0,
        startY: 500,
        seatWidth: 28,
        seatHeight: 28,
        rowGap: 6,
        seatGap: 3,
      },
    },
  });

  console.log('Sections created');

  // Create events
  const event1 = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Classical Music Night',
      titleVi: 'Dem Nhac Co Dien',
      description: 'An evening of classical masterpieces performed by the Vietnam National Symphony Orchestra.',
      descriptionVi: 'Mot dem thuong thuc nhung kiet tac am nhac co dien do Dan nhac Giao huong Quoc gia Viet Nam trinh dien.',
      category: 'music',
      imageUrl: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=600&h=400&fit=crop',
      status: EventStatus.PUBLISHED,
    },
  });

  const event2 = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Tech Conference 2025',
      titleVi: 'Hoi nghi Cong nghe 2025',
      description: 'Annual technology conference featuring top speakers from Southeast Asia.',
      descriptionVi: 'Hoi nghi cong nghe thuong nien voi cac dien gia hang dau Dong Nam A.',
      category: 'conference',
      imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop',
      status: EventStatus.PUBLISHED,
    },
  });

  const event3 = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Comedy Night Live',
      titleVi: 'Dem Hai Kich Truc Tiep',
      description: 'Stand-up comedy featuring Vietnam top comedians.',
      descriptionVi: 'Hai doc lap voi cac nghe si hai hang dau Viet Nam.',
      category: 'comedy',
      imageUrl: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=600&h=400&fit=crop',
      status: EventStatus.PUBLISHED,
    },
  });

  const event4 = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Vietnam Jazz Festival 2026',
      titleVi: 'Lien hoan Jazz Viet Nam 2026',
      description: 'Three days of world-class jazz performances in the heart of Saigon. Featuring international and local artists.',
      descriptionVi: 'Ba ngay trinh dien jazz dang cap quoc te tai trung tam Sai Gon. Quy tu cac nghe si quoc te va trong nuoc.',
      category: 'music',
      imageUrl: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=600&h=400&fit=crop',
      status: EventStatus.PUBLISHED,
    },
  });

  const event5 = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Startup Summit Vietnam',
      titleVi: 'Hoi nghi Khoi nghiep Viet Nam',
      description: 'Connect with 500+ founders, investors, and tech leaders. Pitch competitions, workshops, and networking.',
      descriptionVi: 'Ket noi voi 500+ nha sang lap, nha dau tu va lanh dao cong nghe. Thi thuyết trinh, hoi thao va giao luu.',
      category: 'conference',
      imageUrl: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=600&h=400&fit=crop',
      status: EventStatus.PUBLISHED,
    },
  });

  const event6 = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Ballet: Swan Lake',
      titleVi: 'Ballet: Ho Thien Nga',
      description: 'The timeless classic performed by the Vietnam National Ballet Company. A magical evening of dance.',
      descriptionVi: 'Kiet tac bat hu do Doan Mua Quoc gia Viet Nam trinh dien. Mot dem huyen ao cua nghe thuat mua.',
      category: 'arts',
      imageUrl: 'https://images.unsplash.com/photo-1518834107812-67b0b7c58434?w=600&h=400&fit=crop',
      status: EventStatus.PUBLISHED,
    },
  });

  const event7 = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Electronic Music Night - DJ Festival',
      titleVi: 'Dem Nhac Dien Tu - Le hoi DJ',
      description: 'Top DJs from Asia spinning at the biggest indoor EDM event. Immersive lights and sound.',
      descriptionVi: 'Cac DJ hang dau chau A trinh dien tai su kien EDM trong nha lon nhat. Am thanh va anh sang song dong.',
      category: 'music',
      imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=400&fit=crop',
      status: EventStatus.PUBLISHED,
    },
  });

  const event8 = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Family Fun Day - Circus Show',
      titleVi: 'Ngay hoi Gia dinh - Xiec',
      description: 'Bring the whole family for an unforgettable circus experience with acrobats, clowns, and magic.',
      descriptionVi: 'Mang ca gia dinh den trai nghiem xiec kho quen voi nghe si nhao lon, he va ao thuat.',
      category: 'family',
      imageUrl: 'https://images.unsplash.com/photo-1567593810070-7a3d471af022?w=600&h=400&fit=crop',
      status: EventStatus.PUBLISHED,
    },
  });

  const event9 = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Vietnamese Traditional Music Concert',
      titleVi: 'Hoa nhac Nhac cu Truyen thong Viet Nam',
      description: 'Experience the beauty of traditional Vietnamese instruments - dan tranh, dan bau, and more.',
      descriptionVi: 'Trai nghiem ve dep cua nhac cu truyen thong Viet Nam - dan tranh, dan bau va nhieu hon.',
      category: 'music',
      imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=400&fit=crop',
      status: EventStatus.PUBLISHED,
    },
  });

  const event10 = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Art Exhibition: Modern Vietnam',
      titleVi: 'Trien lam Nghe thuat: Viet Nam Hien dai',
      description: 'Contemporary art exhibition showcasing 50+ Vietnamese artists. Opening night with live performances.',
      descriptionVi: 'Trien lam nghe thuat duong dai gioi thieu 50+ nghe si Viet Nam. Dem khai mac co bieu dien truc tiep.',
      category: 'exhibition',
      imageUrl: 'https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=600&h=400&fit=crop',
      status: EventStatus.PUBLISHED,
    },
  });

  console.log('Events created');

  // Create showtimes
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15, 12, 0, 0); // 19:00 Vietnam = 12:00 UTC

  const showtime1 = await prisma.showtime.create({
    data: {
      eventId: event1.id,
      venueId: venue1.id,
      startsAt: nextMonth,
      endsAt: new Date(nextMonth.getTime() + 3 * 60 * 60 * 1000),
      timezone: 'Asia/Ho_Chi_Minh',
      saleStatus: SaleStatus.ON_SALE,
      maxTicketsPerUser: 6,
      holdDurationMinutes: 10,
      paymentTimeoutMinutes: 15,
    },
  });

  const showtime2Date = new Date(now.getFullYear(), now.getMonth() + 1, 20, 1, 0, 0); // 08:00 Vietnam
  const showtime2 = await prisma.showtime.create({
    data: {
      eventId: event2.id,
      venueId: venue2.id,
      startsAt: showtime2Date,
      endsAt: new Date(showtime2Date.getTime() + 8 * 60 * 60 * 1000),
      timezone: 'Asia/Ho_Chi_Minh',
      saleStatus: SaleStatus.ON_SALE,
      maxTicketsPerUser: 4,
      holdDurationMinutes: 10,
      paymentTimeoutMinutes: 15,
    },
  });

  const showtime3Date = new Date(now.getFullYear(), now.getMonth() + 2, 1, 13, 0, 0); // 20:00 Vietnam
  const showtime3 = await prisma.showtime.create({
    data: {
      eventId: event1.id,
      venueId: venue1.id,
      startsAt: showtime3Date,
      endsAt: new Date(showtime3Date.getTime() + 2.5 * 60 * 60 * 1000),
      timezone: 'Asia/Ho_Chi_Minh',
      saleStatus: SaleStatus.DRAFT,
      maxTicketsPerUser: 6,
      holdDurationMinutes: 10,
      paymentTimeoutMinutes: 15,
    },
  });

  // Showtimes for new events (all at venue1, ON_SALE)
  const newEventDates = [
    { event: event3, daysOffset: 25 },
    { event: event4, daysOffset: 30 },
    { event: event5, daysOffset: 35 },
    { event: event6, daysOffset: 40 },
    { event: event7, daysOffset: 45 },
    { event: event8, daysOffset: 50 },
    { event: event9, daysOffset: 55 },
    { event: event10, daysOffset: 60 },
  ];

  const newShowtimes = [];
  for (const { event, daysOffset } of newEventDates) {
    const date = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    date.setHours(12, 0, 0, 0);
    const st = await prisma.showtime.create({
      data: {
        eventId: event.id,
        venueId: venue1.id,
        startsAt: date,
        endsAt: new Date(date.getTime() + 3 * 60 * 60 * 1000),
        timezone: 'Asia/Ho_Chi_Minh',
        saleStatus: SaleStatus.ON_SALE,
        maxTicketsPerUser: 6,
        holdDurationMinutes: 10,
        paymentTimeoutMinutes: 15,
      },
    });
    newShowtimes.push(st);
  }

  // Create seats for new showtimes (same layout as showtime1)
  for (const st of newShowtimes) {
    const catVIP = await prisma.seatCategory.create({
      data: {
        showtimeId: st.id,
        sectionId: v1SectionVIP.id,
        name: 'VIP',
        nameVi: 'VIP',
        price: 1500000,
        currency: 'VND',
        color: '#FFD700',
      },
    });
    const catStd = await prisma.seatCategory.create({
      data: {
        showtimeId: st.id,
        sectionId: v1SectionStandard.id,
        name: 'Standard',
        nameVi: 'Thuong',
        price: 600000,
        currency: 'VND',
        color: '#4CAF50',
      },
    });

    const seatsBatch = [];
    const vipRows = ['A', 'B', 'C', 'D', 'E'];
    for (let r = 0; r < vipRows.length; r++) {
      for (let s = 1; s <= 10; s++) {
        seatsBatch.push({
          showtimeId: st.id,
          sectionId: v1SectionVIP.id,
          categoryId: catVIP.id,
          row: vipRows[r],
          number: s.toString(),
          label: `${vipRows[r]}${s}`,
          x: s * 45,
          y: r * 50,
          isActive: true,
        });
      }
    }
    const stdRowNames = ['F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
    for (let r = 0; r < stdRowNames.length; r++) {
      for (let s = 1; s <= 20; s++) {
        seatsBatch.push({
          showtimeId: st.id,
          sectionId: v1SectionStandard.id,
          categoryId: catStd.id,
          row: stdRowNames[r],
          number: s.toString(),
          label: `${stdRowNames[r]}${s}`,
          x: s * 39,
          y: 300 + r * 43,
          isActive: true,
        });
      }
    }
    await prisma.seat.createMany({ data: seatsBatch });
  }

  console.log('Showtimes created');

  // Create seat categories and seats for showtime 1
  const cat1VIP = await prisma.seatCategory.create({
    data: {
      showtimeId: showtime1.id,
      sectionId: v1SectionVIP.id,
      name: 'VIP',
      nameVi: 'VIP',
      price: 2000000, // 2,000,000 VND
      currency: 'VND',
      color: '#FFD700',
    },
  });

  const cat1Standard = await prisma.seatCategory.create({
    data: {
      showtimeId: showtime1.id,
      sectionId: v1SectionStandard.id,
      name: 'Standard',
      nameVi: 'Thuong',
      price: 800000, // 800,000 VND
      currency: 'VND',
      color: '#4CAF50',
    },
  });

  // Generate VIP seats (5 rows x 10 seats)
  const vipSeats = [];
  const rows = ['A', 'B', 'C', 'D', 'E'];
  for (let r = 0; r < rows.length; r++) {
    for (let s = 1; s <= 10; s++) {
      vipSeats.push({
        showtimeId: showtime1.id,
        sectionId: v1SectionVIP.id,
        categoryId: cat1VIP.id,
        row: rows[r],
        number: s.toString(),
        label: `${rows[r]}${s}`,
        x: s * 45,
        y: r * 50,
        isActive: true,
      });
    }
  }
  await prisma.seat.createMany({ data: vipSeats });

  // Generate Standard seats (10 rows x 20 seats)
  const stdSeats = [];
  const stdRows = ['F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
  for (let r = 0; r < stdRows.length; r++) {
    for (let s = 1; s <= 20; s++) {
      stdSeats.push({
        showtimeId: showtime1.id,
        sectionId: v1SectionStandard.id,
        categoryId: cat1Standard.id,
        row: stdRows[r],
        number: s.toString(),
        label: `${stdRows[r]}${s}`,
        x: s * 39,
        y: 300 + r * 43,
        isActive: true,
      });
    }
  }
  await prisma.seat.createMany({ data: stdSeats });

  console.log(`Showtime 1: ${vipSeats.length} VIP + ${stdSeats.length} Standard seats created`);

  // Create seat categories for showtime 2
  const cat2Premium = await prisma.seatCategory.create({
    data: {
      showtimeId: showtime2.id,
      sectionId: v2SectionA.id,
      name: 'Premium',
      nameVi: 'Cao cap',
      price: 1500000,
      currency: 'VND',
      color: '#E91E63',
    },
  });

  const cat2Standard = await prisma.seatCategory.create({
    data: {
      showtimeId: showtime2.id,
      sectionId: v2SectionB.id,
      name: 'Standard',
      nameVi: 'Thuong',
      price: 500000,
      currency: 'VND',
      color: '#2196F3',
    },
  });

  const cat2Floor = await prisma.seatCategory.create({
    data: {
      showtimeId: showtime2.id,
      sectionId: v2SectionFloor.id,
      name: 'Floor Standing',
      nameVi: 'San dung',
      price: 300000,
      currency: 'VND',
      color: '#9C27B0',
    },
  });

  // Generate Section A seats (10 rows x 20 seats for demo)
  const premiumSeats = [];
  const premRows = ['AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ'];
  for (let r = 0; r < premRows.length; r++) {
    for (let s = 1; s <= 20; s++) {
      premiumSeats.push({
        showtimeId: showtime2.id,
        sectionId: v2SectionA.id,
        categoryId: cat2Premium.id,
        row: premRows[r],
        number: s.toString(),
        label: `${premRows[r]}-${s}`,
        x: s * 33,
        y: r * 38,
        isActive: true,
      });
    }
  }
  await prisma.seat.createMany({ data: premiumSeats });

  // Generate Section B seats (10 rows x 30 seats for demo)
  const standardSeats2 = [];
  const stdRows2 = ['BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ'];
  for (let r = 0; r < stdRows2.length; r++) {
    for (let s = 1; s <= 30; s++) {
      standardSeats2.push({
        showtimeId: showtime2.id,
        sectionId: v2SectionB.id,
        categoryId: cat2Standard.id,
        row: stdRows2[r],
        number: s.toString(),
        label: `${stdRows2[r]}-${s}`,
        x: s * 31,
        y: 500 + r * 34,
        isActive: true,
      });
    }
  }
  await prisma.seat.createMany({ data: standardSeats2 });

  // Generate floor standing "seats" (numbered 1-100 for demo)
  const floorSeats = [];
  for (let s = 1; s <= 100; s++) {
    floorSeats.push({
      showtimeId: showtime2.id,
      sectionId: v2SectionFloor.id,
      categoryId: cat2Floor.id,
      row: 'GA',
      number: s.toString(),
      label: `GA-${s}`,
      x: (s % 20) * 30,
      y: Math.floor(s / 20) * 30,
      isActive: true,
    });
  }
  await prisma.seat.createMany({ data: floorSeats });

  console.log(`Showtime 2: ${premiumSeats.length} Premium + ${standardSeats2.length} Standard + ${floorSeats.length} Floor seats created`);

  // Create waiting room for showtime 2
  await prisma.waitingRoom.create({
    data: {
      showtimeId: showtime2.id,
      isActive: false,
      maxConcurrent: 200,
    },
  });

  // Create consent records
  for (const user of [admin, organizer, customer, entryStaff, accountant]) {
    await prisma.consentRecord.create({
      data: {
        userId: user.id,
        version: '1.0',
        consentType: 'TERMS_AND_CONDITIONS',
        grantedAt: new Date(),
        ipAddress: '127.0.0.1',
      },
    });
  }

  console.log('Seed data created successfully!');
  console.log('');
  console.log('Demo accounts (all use password: Password123!):');
  console.log('  Admin:       admin@ticketbooking.vn');
  console.log('  Organizer:   organizer@ticketbooking.vn');
  console.log('  Customer:    customer@ticketbooking.vn');
  console.log('  Entry Staff: staff@ticketbooking.vn');
  console.log('  Accountant:  accountant@ticketbooking.vn');
  console.log('');
  console.log(`Events: ${event1.title}, ${event2.title}, ${event3.title}`);
  console.log(`Venues: ${venue1.name}, ${venue2.name}`);
  console.log(`Showtimes: 3 created (2 ON_SALE, 1 DRAFT)`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
