import { PrismaClient } from '@prisma/client';
import schedulesData from '../schedules.json';

const prisma = new PrismaClient();

interface ScheduleRecord {
  id: number;
  lab_room: string;
  date: string;
  schedule: string;
  course_code: string;
  section: string;
  professor_name: string;
}

async function main() {
  console.log('Starting the seeding process...');

  // The mapping uses the new interface to guarantee data safety
  const formattedSchedules = schedulesData.map((s: ScheduleRecord) => ({
    id: s.id,
    lab_room: s.lab_room,
    date: s.date,
    schedule: s.schedule,
    course_code: s.course_code,
    section: s.section,
    professor_name: s.professor_name
  }));

  const result = await prisma.schedule.createMany({
    data: formattedSchedules,
    skipDuplicates: true,
  });

  console.log(`Successfully added ${result.count} schedules to Aiven!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });