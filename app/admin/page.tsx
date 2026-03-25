"use client";

import { useState, useEffect } from "react";
import { getAdminData, resetStudentDevice } from "../actions";

interface Student {
  student_id: string;
  first_name: string;
  last_name: string;
}

interface AttendanceLog {
  id: number;
  timestamp: Date;
  student: Student;
  schedule: {
    course_code: string;
    section: string;
    lab_room: string;
  };
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (passwordInput === "admin123") {
      setIsAuthenticated(true);
    } else {
      alert("Incorrect password.");
    }
  }

  async function handleResetDevice(studentId: string) {
    if (confirm(`Are you sure you want to reset the device for ${studentId}? They will need to register again.`)) {
      setIsLoading(true);
      const response = await resetStudentDevice(studentId);
      if (response.success) {
        alert(response.message);
        fetchDashboardData();
      } else {
        alert("Failed to reset device.");
      }
      setIsLoading(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-[80vh] flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Admin Access</h2>
          <input
            type="password"
            placeholder="Enter Admin Password"
            className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white outline-none mb-4"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            required
          />
          <button type="submit" className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-lg transition-colors">
            Login
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex justify-between items-end border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Administrator Dashboard</h1>
          <p className="text-gray-500">Manage attendance logs and student device registrations.</p>
        </div>
        <button onClick={() => setIsAuthenticated(false)} className="text-sm text-red-600 font-semibold hover:underline">
          Logout
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
                <th className="p-4 font-semibold">Student</th>
                <th className="p-4 font-semibold">Class</th>
                <th className="p-4 font-semibold">Room</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-medium">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="p-4">{log.student.student_id} - {log.student.first_name} {log.student.last_name}</td>
                  <td className="p-4">{log.schedule.course_code} ({log.schedule.section})</td>
                  <td className="p-4 text-gray-500">{log.schedule.lab_room}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">No attendance logs found.</td>
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