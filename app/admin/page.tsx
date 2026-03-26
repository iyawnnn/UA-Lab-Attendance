"use client";

import { useState, useEffect } from "react";
import { get, set } from "idb-keyval";
import { getAdminData, resetStudentDevice, registerAdminToDatabase, verifyAdminSignature } from "../actions";

interface Student {
  student_id: string;
  first_name: string;
  last_name: string;
}

interface AttendanceLog {
  id: number;
  timestamp: Date;
  status: string;
  student: Student;
  schedule: {
    course_code: string;
    section: string;
    lab_room: string;
  };
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [hasAdminKey, setHasAdminKey] = useState<boolean>(false);
  
  // Setup State
  const [adminId, setAdminId] = useState<string>("");
  const [setupCode, setSetupCode] = useState<string>("");
  
  // Dashboard State
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    async function checkVault() {
      const key = await get("admin_private_key");
      if (key) setHasAdminKey(true);
    }
    checkVault();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated]);

  async function fetchDashboardData() {
    const data = await getAdminData();
    if (data.success) {
      setLogs(data.logs || []);
      setStudents(data.students || []);
    }
  }

  async function handleAdminSetup(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const keyPair = await window.crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        false, 
        ["sign", "verify"]
      );

      await set("admin_private_key", keyPair.privateKey);
      await set("admin_id", adminId);

      const exportedPublicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
      const publicKeyArray = Array.from(new Uint8Array(exportedPublicKey));
      const publicKeyBase64 = btoa(String.fromCharCode(...publicKeyArray));

      const response = await registerAdminToDatabase({
        adminId: adminId,
        publicKey: publicKeyBase64,
        setupCode: setupCode
      });

      if (response.success) {
        setHasAdminKey(true);
        setMessage("Admin device registered. You can now log in securely.");
      } else {
        setMessage(response.message);
      }
    } catch (error) {
      console.error(error);
      setMessage("Failed to generate secure keys.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSecureLogin() {
    setIsLoading(true);
    setMessage("");

    try {
      const storedAdminId = await get("admin_id");
      const privateKey = await get("admin_private_key");

      if (!storedAdminId || !privateKey) {
        setMessage("Security keys missing from device.");
        setIsLoading(false);
        return;
      }

      const timestamp = new Date().toISOString();
      const messageToSign = `ADMIN-LOGIN-${storedAdminId}-${timestamp}`;

      const encoder = new TextEncoder();
      const encodedMessage = encoder.encode(messageToSign);

      const rawSignature = await window.crypto.subtle.sign(
        { name: "ECDSA", hash: { name: "SHA-256" } },
        privateKey,
        encodedMessage
      );

      const signatureArray = Array.from(new Uint8Array(rawSignature));
      const signatureBase64 = btoa(String.fromCharCode(...signatureArray));

      const response = await verifyAdminSignature({
        adminId: storedAdminId,
        timestamp: timestamp,
        signature: signatureBase64
      });

      if (response.success) {
        setIsAuthenticated(true);
      } else {
        setMessage(response.message);
      }
    } catch (error) {
      console.error(error);
      setMessage("Cryptographic verification failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetDevice(targetStudentId: string) {
    if (confirm(`Are you sure you want to reset the device for ${targetStudentId}?`)) {
      setIsLoading(true);
      const response = await resetStudentDevice(targetStudentId);
      if (response.success) {
        alert(response.message);
        fetchDashboardData();
      } else {
        alert("Failed to reset device.");
      }
      setIsLoading(false);
    }
  }

  // View 1: Setup Device
  if (!hasAdminKey) {
    return (
      <main className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 w-full max-w-md relative">
          <a href="/" className="absolute top-6 left-6 text-sm text-gray-400 hover:text-blue-600 transition-colors">
            &larr; Home
          </a>
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-2 mt-4">Admin Device Setup</h2>
          <p className="text-center text-gray-500 text-sm mb-6">Initialize ECDSA security for this device.</p>
          
          <form onSubmit={handleAdminSetup} className="space-y-4">
            <input
              type="text"
              placeholder="Admin Username (e.g. admin_master)"
              className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-blue-500 outline-none"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Master Authorization Code"
              className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-blue-500 outline-none"
              value={setupCode}
              onChange={(e) => setSetupCode(e.target.value)}
              required
            />
            <button type="submit" disabled={isLoading} className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-lg transition-colors">
              {isLoading ? "Generating Keys..." : "Register Admin Device"}
            </button>
          </form>
          {message && <p className="mt-4 text-center text-red-600 text-sm font-semibold">{message}</p>}
        </div>
      </main>
    );
  }

  // View 2: ECDSA Login
  if (!isAuthenticated) {
    return (
      <main className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm text-center relative">
          <a href="/" className="absolute top-6 left-6 text-sm text-gray-400 hover:text-blue-600 transition-colors">
            &larr; Home
          </a>
          <h2 className="text-2xl font-bold text-gray-800 mb-2 mt-4">Secure Admin Login</h2>
          <p className="text-gray-500 text-sm mb-6">Device recognized. Cryptographic signature required.</p>
          <button 
            onClick={handleSecureLogin} 
            disabled={isLoading}
            className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md"
          >
            {isLoading ? "Verifying Signature..." : "Unlock Dashboard"}
          </button>
          {message && <p className="mt-4 text-red-600 text-sm font-semibold">{message}</p>}
        </div>
      </main>
    );
  }

  // View 3: The Dashboard
  return (
    <main className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex justify-between items-end border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Administrator Dashboard</h1>
          <p className="text-gray-500">Secured via Elliptic Curve Cryptography (P-256)</p>
        </div>
        <button onClick={() => setIsAuthenticated(false)} className="text-sm text-red-600 font-semibold hover:underline">
          Lock Dashboard
        </button>
      </header>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-700">Recent Attendance Logs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider">
                <th className="p-4 font-semibold">Time</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Student</th>
                <th className="p-4 font-semibold">Class</th>
                <th className="p-4 font-semibold">Room</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-medium">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${log.status === 'LATE' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="p-4">{log.student.student_id} - {log.student.first_name} {log.student.last_name}</td>
                  <td className="p-4">{log.schedule.course_code} ({log.schedule.section})</td>
                  <td className="p-4 text-gray-500">{log.schedule.lab_room}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">No attendance logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-700">Registered Devices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider">
                <th className="p-4 font-semibold">Student ID</th>
                <th className="p-4 font-semibold">Name</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {students.map((student) => (
                <tr key={student.student_id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-medium">{student.student_id}</td>
                  <td className="p-4">{student.first_name} {student.last_name}</td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => handleResetDevice(student.student_id)}
                      disabled={isLoading}
                      className="text-sm bg-red-50 text-red-600 px-3 py-1 rounded hover:bg-red-100 font-semibold transition-colors"
                    >
                      Reset Device
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}