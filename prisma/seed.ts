import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Reading schedules.json...');
  
  // 1. Locate and read the JSON file
  const schedulesPath = path.join(process.cwd(), 'schedules.json');
  const schedulesData = JSON.parse(fs.readFileSync(schedulesPath, 'utf-8'));

  console.log(`Found ${schedulesData.length} schedules. Migrating to database...`);

  // 2. Delete any leftover schedules just to be safe
  await prisma.schedule.deleteMany();

  // 3. Loop through the JSON and create records in the database
  for (const sched of schedulesData) {
    await prisma.schedule.create({
      data: {
        lab_room: sched.lab_room,
        date: sched.date,
        schedule: sched.schedule,
        course_code: sched.course_code,
        section: sched.section,
        professor_name: sched.professor_name,
      },
    });
  }

  console.log('✅ Seeding completed successfully! Your schedules are back online.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });