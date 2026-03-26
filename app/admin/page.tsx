"use client";

import { useState, useEffect } from "react";
import { get, set } from "idb-keyval";
import { getAdminData, resetStudentDevice, registerAdminToDatabase, verifyAdminSignature } from "../actions";
import { AttendanceLog, Student, Schedule } from "./types";
import AttendanceTab from "./components/AttendanceTab";
import SchedulesTab from "./components/SchedulesTab";
import DevicesTab from "./components/DevicesTab";

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [hasAdminKey, setHasAdminKey] = useState<boolean>(false);
  
  const [adminId, setAdminId] = useState<string>("");
  const [setupCode, setSetupCode] = useState<string>("");
  
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  const [activeTab, setActiveTab] = useState<"attendance" | "schedules" | "devices">("attendance");

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
      setSchedules(data.schedules || []);
    }
  }

  async function handleAdminSetup(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const keyPair = await window.crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
      await set("admin_private_key", keyPair.privateKey);
      await set("admin_id", adminId);

      const exportedPublicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
      const publicKeyArray = Array.from(new Uint8Array(exportedPublicKey));
      const publicKeyBase64 = btoa(String.fromCharCode(...publicKeyArray));

      const response = await registerAdminToDatabase({ adminId, publicKey: publicKeyBase64, setupCode });

      if (response.success) {
        setHasAdminKey(true);
        setMessage("Administrator device successfully registered.");
      } else {
        setMessage(response.message);
      }
    } catch (error) {
      console.error(error);
      setMessage("Failed to generate cryptographic keys.");
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
        setMessage("Security credentials missing from device.");
        setIsLoading(false);
        return;
      }

      const timestamp = new Date().toISOString();
      const messageToSign = `ADMIN-LOGIN-${storedAdminId}-${timestamp}`;

      const encoder = new TextEncoder();
      const encodedMessage = encoder.encode(messageToSign);
      const rawSignature = await window.crypto.subtle.sign({ name: "ECDSA", hash: { name: "SHA-256" } }, privateKey, encodedMessage);

      const signatureArray = Array.from(new Uint8Array(rawSignature));
      const signatureBase64 = btoa(String.fromCharCode(...signatureArray));

      const response = await verifyAdminSignature({ adminId: storedAdminId as string, timestamp, signature: signatureBase64 });

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
    if (confirm(`Are you certain you want to reset the device for Student ID: ${targetStudentId}?`)) {
      setIsLoading(true);
      const response = await resetStudentDevice(targetStudentId);
      if (response.success) {
        alert("Device reset successfully.");
        fetchDashboardData();
      } else {
        alert("Failed to reset device.");
      }
      setIsLoading(false);
    }
  }

  if (!hasAdminKey) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-xl shadow-lg border border-slate-200 w-full max-w-lg relative">
          <a href="/" className="absolute top-8 left-8 text-sm font-medium text-slate-400 hover:text-slate-800 transition-colors">Back to Home</a>
          <div className="text-center mb-8 mt-6">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">System Setup</h2>
            <p className="text-slate-500 text-sm mt-2">Initialize administrator cryptographic credentials.</p>
          </div>
          <form onSubmit={handleAdminSetup} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Administrator ID</label>
              <input type="text" placeholder="Enter your system identifier" className="w-full px-4 py-3 rounded-md bg-slate-50 border border-slate-300 outline-none" value={adminId} onChange={(e) => setAdminId(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Authorization Code</label>
              <input type="password" placeholder="Enter master setup code" className="w-full px-4 py-3 rounded-md bg-slate-50 border border-slate-300 outline-none" value={setupCode} onChange={(e) => setSetupCode(e.target.value)} required />
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-md mt-4">{isLoading ? "Generating Secure Keys..." : "Authorize Device"}</button>
          </form>
          {message && <p className="mt-6 text-center text-rose-600 text-sm font-medium">{message}</p>}
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-xl shadow-lg border border-slate-200 w-full max-w-md text-center relative">
          <a href="/" className="absolute top-8 left-8 text-sm font-medium text-slate-400 hover:text-slate-800 transition-colors">Back to Home</a>
          <div className="mb-8 mt-6">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Admin Authentication</h2>
            <p className="text-slate-500 text-sm mt-2">Device verified. Digital signature required for access.</p>
          </div>
          <button onClick={handleSecureLogin} disabled={isLoading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-md transition-colors shadow-md">
            {isLoading ? "Verifying Signature..." : "Unlock System"}
          </button>
          {message && <p className="mt-6 text-rose-600 text-sm font-medium">{message}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-white border-b border-slate-200 pt-8 pb-4 px-8 mb-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Administrator Control Panel</h1>
            <p className="text-slate-500 text-sm mt-1">Secured via ECDSA P-256</p>
          </div>
          <button onClick={() => setIsAuthenticated(false)} className="text-sm bg-slate-100 text-slate-700 font-medium px-4 py-2 rounded-md hover:bg-slate-200 transition-colors">Lock Session</button>
        </div>
        <div className="max-w-7xl mx-auto mt-8 flex space-x-8">
          <button onClick={() => setActiveTab("attendance")} className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "attendance" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}>Attendance Records</button>
          <button onClick={() => setActiveTab("schedules")} className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "schedules" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}>System Schedules</button>
          <button onClick={() => setActiveTab("devices")} className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "devices" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}>Device Management</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8">
        {activeTab === "attendance" && <AttendanceTab logs={logs} />}
        {activeTab === "schedules" && <SchedulesTab schedules={schedules} refreshData={fetchDashboardData} />}
        {activeTab === "devices" && <DevicesTab students={students} onResetDevice={handleResetDevice} isLoading={isLoading} />}
      </div>
    </main>
  );
}