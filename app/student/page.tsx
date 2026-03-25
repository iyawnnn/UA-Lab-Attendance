"use client";

import { useState, useEffect } from "react";
import { get } from "idb-keyval";
import { getLabRooms, submitAttendance } from "../actions";

interface Schedule {
  id: number;
  lab_room: string;
  course_code: string;
  section: string;
}

export default function LogAttendance() {
  const [labRooms, setLabRooms] = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  
  // New state for testing the time
  const [simulatedTime, setSimulatedTime] = useState<string>("");
  
  const [message, setMessage] = useState<string>("");
  const [isError, setIsError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    async function fetchRooms() {
      const response = await getLabRooms();
      if (response.success) {
        setLabRooms(response.data);
      }
    }
    fetchRooms();
  }, []);

  async function handleLogAttendance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const studentId = await get("student_id");
      const privateKey = await get("student_private_key");

      if (!studentId || !privateKey) {
        setIsError(true);
        setMessage("Error: Device not registered. Please go to the home page and register first.");
        setIsLoading(false);
        return;
      }

      if (!selectedRoom) {
        setIsError(true);
        setMessage("Please select a lab room.");
        setIsLoading(false);
        return;
      }

      if (!simulatedTime) {
        setIsError(true);
        setMessage("Please select a simulated time for testing.");
        setIsLoading(false);
        return;
      }

      // We use your manual input instead of the real clock
      const timestamp = new Date(simulatedTime).toISOString();
      
      const messageToSign = `${studentId}-${selectedRoom}-${timestamp}`;

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
        studentId: studentId as string,
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
      setMessage("An error occurred while signing the attendance.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-8 border border-gray-100">
        
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Log Attendance</h2>
          <p className="text-gray-500 mt-2 text-sm">Select a room and a custom time to test the scheduling logic.</p>
        </div>
        
        <form onSubmit={handleLogAttendance} className="space-y-6">
          <div>
            <label htmlFor="labRoom" className="block text-sm font-semibold text-gray-700 mb-2">Lab Room</label>
            <select
              id="labRoom"
              className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 outline-none transition-all cursor-pointer"
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              required
            >
              <option value="" disabled>Select your lab room...</option>
              {labRooms.map((room, index) => (
                <option key={index} value={room}>
                  {room}
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <label htmlFor="simulatedTime" className="block text-sm font-semibold text-yellow-800 mb-2">
              Testing Override: Set Current Time
            </label>
            <input
              type="datetime-local"
              id="simulatedTime"
              className="w-full px-4 py-3 rounded-lg bg-white border border-yellow-300 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 outline-none transition-all"
              value={simulatedTime}
              onChange={(e) => setSimulatedTime(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md disabled:bg-green-400 mt-4"
            disabled={isLoading || labRooms.length === 0}
          >
            {isLoading ? "Verifying..." : "Test Attendance Logic"}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-4 rounded-lg text-sm font-medium ${isError ? "bg-red-50 text-red-700 border border-red-200" : (message.includes("LATE") ? "bg-yellow-50 text-yellow-800 border border-yellow-300" : "bg-green-50 text-green-700 border border-green-200")}`}>
            {message}
          </div>
        )}

      </div>
    </main>
  );
}