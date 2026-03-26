"use server";

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function parseTimeInMinutes(timeString: string) {
  const parts = timeString.trim().split(" ");
  const time = parts[0];
  const period = parts[1];

  let hours = parseInt(time.split(":")[0]);
  const minutes = parseInt(time.split(":")[1]);

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

export async function registerStudentToDatabase(data: {
  studentId: string;
  firstName: string;
  lastName: string;
  publicKey: string;
}) {
  try {
    await prisma.student.create({
      data: {
        student_id: data.studentId,
        first_name: data.firstName,
        last_name: data.lastName,
        public_key: data.publicKey,
      },
    });
    return { success: true, message: "Student securely registered in the database." };
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      return { success: false, message: "This Student ID is already registered." };
    }
    console.error(error); 
    return { success: false, message: "Failed to connect to the database." };
  }
}

export async function getLabRooms() {
  try {
    const schedules = await prisma.schedule.findMany({
      select: { lab_room: true },
      distinct: ['lab_room'],
    });
    const rooms = schedules.map(s => s.lab_room);
    return { success: true, data: rooms };
  } catch (error) {
    console.error(error);
    return { success: false, data: [] };
  }
}

export async function submitAttendance(data: {
  studentId: string;
  labRoom: string;
  timestamp: string;
  signature: string;
}) {
  try {
    const student = await prisma.student.findUnique({
      where: { student_id: data.studentId }
    });

    if (!student) {
      return { success: false, message: "Student not found. Please register your device first." };
    }

    const publicKeyArray = Uint8Array.from(atob(student.public_key), c => c.charCodeAt(0));
    const importedPublicKey = await globalThis.crypto.subtle.importKey(
      "spki",
      publicKeyArray,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"]
    );

    const signedMessage = `${data.studentId}-${data.labRoom}-${data.timestamp}`;
    const encoder = new TextEncoder();
    const messageData = encoder.encode(signedMessage);
    const signatureArray = Uint8Array.from(atob(data.signature), c => c.charCodeAt(0));

    const isValid = await globalThis.crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      importedPublicKey,
      signatureArray,
      messageData
    );

    if (!isValid) return { success: false, message: "Security Error: Invalid digital signature." };

    const timestampDate = new Date(data.timestamp);
    const currentDay = timestampDate.toLocaleDateString("en-US", { weekday: "long" });
    const currentMinutes = timestampDate.getHours() * 60 + timestampDate.getMinutes();

    const roomSchedules = await prisma.schedule.findMany({
      where: { lab_room: data.labRoom, date: currentDay }
    });

    let activeScheduleId = null;
    let isLate = false;

    for (const sched of roomSchedules) {
      const times = sched.schedule.split("-");
      const startMinutes = parseTimeInMinutes(times[0]);
      const endMinutes = parseTimeInMinutes(times[1]);

      if (currentMinutes >= startMinutes - 30 && currentMinutes <= endMinutes) {
        activeScheduleId = sched.id;
        if (currentMinutes > startMinutes + 15) isLate = true;
        break;
      }
    }

    if (!activeScheduleId) return { success: false, message: "There is no active class in this lab room right now." };

    const todayStart = new Date(timestampDate);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(timestampDate);
    todayEnd.setHours(23, 59, 59, 999);

    const existingLog = await prisma.attendanceLog.findFirst({
      where: {
        student_id: data.studentId,
        schedule_id: activeScheduleId,
        timestamp: { gte: todayStart, lte: todayEnd }
      }
    });

    if (existingLog) return { success: false, message: "You have already logged your attendance for this class today." };

    const attendanceStatus = isLate ? "LATE" : "ON_TIME";

    await prisma.attendanceLog.create({
      data: {
        student_id: data.studentId,
        schedule_id: activeScheduleId,
        timestamp: timestampDate,
        status: attendanceStatus,
        signature: data.signature,
      }
    });

    const statusMessage = isLate ? "Attendance logged successfully, but you are marked as LATE." : "Attendance securely verified and logged on time!";
    return { success: true, message: statusMessage };

  } catch (error) {
    console.error(error);
    return { success: false, message: "An error occurred on the server." };
  }
}

export async function getAdminData() {
  try {
    const logs = await prisma.attendanceLog.findMany({
      include: { student: true, schedule: true },
      orderBy: { timestamp: 'desc' }
    });
    const students = await prisma.student.findMany();
    // Fetch the schedules to display in the new viewer
    const schedules = await prisma.schedule.findMany({
      orderBy: [
        { lab_room: 'asc' },
        { date: 'asc' }
      ]
    });
    return { success: true, logs, students, schedules };
  } catch (error) {
    console.error(error);
    return { success: false, logs: [], students: [], schedules: [] };
  }
}

export async function resetStudentDevice(studentId: string) {
  try {
    await prisma.student.delete({
      where: { student_id: studentId }
    });
    return { success: true, message: "Student device reset successfully." };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Failed to reset device." };
  }
}

export async function registerAdminToDatabase(data: {
  adminId: string;
  publicKey: string;
  setupCode: string;
}) {
  try {
    // Check against the secure environment variable
    if (data.setupCode !== process.env.ADMIN_SETUP_SECRET) {
      return { success: false, message: "Invalid setup authorization code." };
    }

    await prisma.admin.create({
      data: {
        admin_id: data.adminId,
        public_key: data.publicKey,
      },
    });
    return { success: true, message: "Admin device securely registered." };
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      return { success: false, message: "This Admin ID is already registered." };
    }
    console.error(error);
    return { success: false, message: "Failed to connect to the database." };
  }
}

export async function verifyAdminSignature(data: {
  adminId: string;
  timestamp: string;
  signature: string;
}) {
  try {
    const admin = await prisma.admin.findUnique({
      where: { admin_id: data.adminId }
    });

    if (!admin) {
      return { success: false, message: "Admin profile not found." };
    }

    const publicKeyArray = Uint8Array.from(atob(admin.public_key), c => c.charCodeAt(0));
    const importedPublicKey = await globalThis.crypto.subtle.importKey(
      "spki",
      publicKeyArray,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"]
    );

    const signedMessage = `ADMIN-LOGIN-${data.adminId}-${data.timestamp}`;
    const encoder = new TextEncoder();
    const messageData = encoder.encode(signedMessage);
    const signatureArray = Uint8Array.from(atob(data.signature), c => c.charCodeAt(0));

    const isValid = await globalThis.crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      importedPublicKey,
      signatureArray,
      messageData
    );

    if (!isValid) return { success: false, message: "Security Error: Invalid admin signature." };

    return { success: true, message: "Admin identity verified." };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Server error during verification." };
  }
}