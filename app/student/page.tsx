"use client";

import { useState, useEffect } from "react";
import { get, set } from "idb-keyval";
import { registerStudentToDatabase, getLabRooms, submitAttendance } from "../actions";

export default function SmartStudentPortal() {
  // Navigation State
  const [view, setView] = useState<"loading" | "register" | "attendance">("loading");
  
  // Registration State
  const [studentId, setStudentId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // Attendance State
  const [labRooms, setLabRooms] = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [isLogging, setIsLogging] = useState(false);

  // Shared State
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    async function initialize() {
      const privateKey = await get("student_private_key");
      if (privateKey) {
        setView("attendance");
        fetchRooms();
      } else {
        setView("register");
      }
    }
    initialize();
  }, []);

  async function fetchRooms() {
    const response = await getLabRooms();
    if (response.success) {
      setLabRooms(response.data);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setIsRegistering(true);
    setMessage("");
    setIsError(false);

    try {
      const keyPair = await window.crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        false, 
        ["sign", "verify"]
      );

      await set("student_private_key", keyPair.privateKey);
      await set("student_id", studentId);

      const exportedPublicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
      const publicKeyArray = Array.from(new Uint8Array(exportedPublicKey));
      const publicKeyBase64 = btoa(String.fromCharCode(...publicKeyArray));

      const dbResponse = await registerStudentToDatabase({
        studentId,
        firstName,
        lastName,
        publicKey: publicKeyBase64,
      });

      if (dbResponse.success) {
        setMessage("Device registered successfully!");
        setTimeout(() => {
          setMessage("");
          setView("attendance");
          fetchRooms();
        }, 1500);
      } else {
        setIsError(true);
        setMessage(dbResponse.message);
      }
    } catch (error) {
      console.error(error);
      setIsError(true);
      setMessage("Error generating security keys.");
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleLogAttendance(e: React.FormEvent) {
    e.preventDefault();
    setIsLogging(true);
    setMessage("");
    setIsError(false);

    try {
      const storedStudentId = await get("student_id");
      const privateKey = await get("student_private_key");

      if (!storedStudentId || !privateKey || !selectedRoom) {
        setIsError(true);
        setMessage("Missing device security keys or lab room selection.");
        setIsLogging(false);
        return;
      }

      const timestamp = new Date().toISOString();
      const messageToSign = `${storedStudentId}-${selectedRoom}-${timestamp}`;

      const encoder = new TextEncoder();
      const encodedMessage = encoder.encode(messageToSign);

      const rawSignature = await window.crypto.subtle.sign(
        { name: "ECDSA", hash: { name: "SHA-256" } },
        privateKey,
        encodedMessage
      );

      const signatureArray = Array.from(new Uint8Array(rawSignature));
      const signatureBase64 = btoa(String.fromCharCode(...signatureArray));

      const response = await submitAttendance({
        studentId: storedStudentId as string,
        labRoom: selectedRoom,
        timestamp: timestamp,
        signature: signatureBase64
      });

      if (response.success) {
        setMessage(response.message);
      } else {
        setIsError(true);
        setMessage(response.message);
      }
    } catch (error) {
      console.error(error);
      setIsError(true);
      setMessage("An error occurred during verification.");
    } finally {
      setIsLogging(false);
    }
  }

  if (view === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Checking device security...</div>;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8 border border-gray-100 relative">
        
        {/* Simple navigation back to home */}
        <a href="/" className="absolute top-6 left-6 text-sm text-gray-400 hover:text-blue-600 transition-colors">
          &larr; Home
        </a>

        {view === "register" ? (
          <>
            <div className="text-center mb-8 mt-4">
              <h2 className="text-2xl font-bold text-gray-800">Register Device</h2>
              <p className="text-gray-500 mt-2 text-sm">One-time setup for ECC attendance tracking.</p>
            </div>
            
            <form onSubmit={handleRegister} className="space-y-4">
              <input type="text" placeholder="Student ID" className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 outline-none" value={studentId} onChange={(e) => setStudentId(e.target.value)} required />
              <input type="text" placeholder="First Name" className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 outline-none" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              <input type="text" placeholder="Last Name" className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 outline-none" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              
              <button type="submit" disabled={isRegistering} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg mt-2">
                {isRegistering ? "Registering..." : "Register Device"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="text-center mb-8 mt-4">
              <h2 className="text-2xl font-bold text-gray-800">Log Attendance</h2>
              <p className="text-gray-500 mt-2 text-sm">Select your current lab room.</p>
            </div>
            
            <form onSubmit={handleLogAttendance} className="space-y-6">
              <select className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 outline-none cursor-pointer" value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} required>
                <option value="" disabled>Select your lab room...</option>
                {labRooms.map((room, index) => (
                  <option key={index} value={room}>{room}</option>
                ))}
              </select>

              <button type="submit" disabled={isLogging || labRooms.length === 0} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-green-400 mt-4">
                {isLogging ? "Verifying..." : "Log Attendance"}
              </button>
            </form>
          </>
        )}

        {message && (
          <div className={`mt-6 p-4 rounded-lg text-sm font-medium ${isError ? "bg-red-50 text-red-700 border-red-200" : (message.includes("LATE") ? "bg-yellow-50 text-yellow-800 border-yellow-300" : "bg-green-50 text-green-700 border-green-200")} border`}>
            {message}
          </div>
        )}

      </div>
    </main>
  );
}