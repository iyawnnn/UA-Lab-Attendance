"use server";

import { PrismaClient } from '@prisma/client';
import bcrypt from "bcryptjs";

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
  recoveryPin: string;
}) {
  try {
    const existingStudent = await prisma.student.findUnique({
      where: { student_id: data.studentId },
    });

    if (existingStudent) {
      return { success: false, message: "Student ID is already registered to a device." };
    }

    // Hash the PIN before saving to database
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(data.recoveryPin, salt);

    await prisma.student.create({
      data: {
        student_id: data.studentId,
        first_name: data.firstName,
        last_name: data.lastName,
        public_key: data.publicKey,
        recovery_pin: hashedPin,
      },
    });

    return { success: true, message: "Student registered successfully." };
  } catch (error) {
    console.error("Database error:", error);
    return { success: false, message: "Failed to connect to the database." };
  }
}

export async function recoverStudentDevice(studentId: string, pin: string) {
  try {
    const student = await prisma.student.findUnique({
      where: { student_id: studentId }
    });

    if (!student) {
      return { success: false, message: "Student ID not found in the system." };
    }

    const isPinValid = await bcrypt.compare(pin, student.recovery_pin);

    if (!isPinValid) {
      return { success: false, message: "Incorrect Recovery PIN." };
    }

    // PIN is correct, delete the old record so they can register their new phone
    await prisma.student.delete({
      where: { student_id: studentId }
    });

    return { success: true, message: "Device access revoked. You may now register your new device." };

  } catch (error) {
    console.error("Recovery error:", error);
    return { success: false, message: "Failed to process recovery request." };
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

function convertTimeToMinutes(timeStr: string) {
  // Removes all spaces and forces uppercase so "4:10PM" and " 04:10 PM " become identical
  const cleanStr = timeStr.replace(/\s+/g, "").toUpperCase();
  
  // Extracts the hours, minutes, and AM/PM regardless of formatting
  const match = cleanStr.match(/(\d+):(\d+)(AM|PM)/);
  if (!match) return 0;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const modifier = match[3];
  
  if (hours === 12) {
    hours = modifier === "AM" ? 0 : 12;
  } else if (modifier === "PM") {
    hours += 12;
  }
  
  return hours * 60 + minutes;
}

export async function submitAttendance(data: {
  studentId: string;
  labRoom: string;
  timestamp: string;
  signature: string;
}) {
  try {
    const student = await prisma.student.findUnique({
      where: { student_id: data.studentId },
    });

    if (!student) {
      return { success: false, message: "Student not found in the database. Please register." };
    }

    // 1. Cryptographic Verification (Your existing security)
    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode(`${data.studentId}-${data.labRoom}-${data.timestamp}`);
    
    const binarySignature = new Uint8Array(atob(data.signature).split("").map(c => c.charCodeAt(0)));
    const binaryPublicKey = new Uint8Array(atob(student.public_key).split("").map(c => c.charCodeAt(0)));

    const importedPublicKey = await crypto.subtle.importKey(
      "spki",
      binaryPublicKey,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"]
    );

    const isValid = await crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      importedPublicKey,
      binarySignature,
      encodedMessage
    );

    if (!isValid) {
      return { success: false, message: "Digital signature verification failed." };
    }

    // 2. Time-Fencing Logic (Philippine Standard Time)
    const now = new Date();
    const phTimeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });

    const timeParts = phTimeFormatter.formatToParts(now);
    let currentDay = "";
    let currentHour = 0;
    let currentMinute = 0;

    for (const part of timeParts) {
      if (part.type === 'weekday') currentDay = part.value;
      if (part.type === 'hour') currentHour = parseInt(part.value);
      if (part.type === 'minute') currentMinute = parseInt(part.value);
    }

    const currentMinutesSinceMidnight = (currentHour * 60) + currentMinute;

    // Fetch schedules for this specific room and today's day
    const activeSchedules = await prisma.schedule.findMany({
      where: {
        lab_room: data.labRoom,
        date: currentDay
      }
    });

    let matchedScheduleId = null;
    let attendanceStatus = "ON_TIME";

    for (const sched of activeSchedules) {
      const [startStr, endStr] = sched.schedule.split(" - ");
      const classStartMins = convertTimeToMinutes(startStr);
      const classEndMins = convertTimeToMinutes(endStr);

      // We allow them to log in 15 minutes before the class starts
      const allowedStartMins = classStartMins - 15;

      if (currentMinutesSinceMidnight >= allowedStartMins && currentMinutesSinceMidnight <= classEndMins) {
        matchedScheduleId = sched.id;
        
        // If they log in 16 or more minutes after the class start time, mark as late
        if (currentMinutesSinceMidnight > (classStartMins + 15)) {
          attendanceStatus = "LATE";
        }
        break;
      }
    }

if (!matchedScheduleId) {
      return { 
        success: false, 
        message: "Error: No active class session found for you in this room at this current time." 
      };
    }

    // 3. ANTI-SPAM CHECK: Prevent duplicate logs for the same session today
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    
    const existingLog = await prisma.attendanceLog.findFirst({
      where: {
        student_id: data.studentId,
        schedule_id: matchedScheduleId,
        timestamp: {
          gte: twelveHoursAgo
        }
      }
    });

    if (existingLog) {
      return { 
        success: false, 
        message: "Attendance already recorded for this session today." 
      };
    }

    // 4. Save the Verified and Time-Checked Record
    await prisma.attendanceLog.create({
      data: {
        student_id: data.studentId,
        schedule_id: matchedScheduleId,
        status: attendanceStatus,
      },
    });

    return { 
      success: true, 
      message: `Attendance securely recorded. Status: ${attendanceStatus}` 
    };

  } catch (error) {
    console.error("Attendance submission error:", error);
    return { success: false, message: "Server error while processing attendance." };
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