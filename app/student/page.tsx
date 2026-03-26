"use client";

import { useState, useEffect } from "react";
import { get, set, del } from "idb-keyval";
import {
  registerStudentToDatabase,
  getLabRooms,
  submitAttendance,
  recoverStudentDevice,
  checkRevokedStatus,
} from "../actions";

export default function SmartStudentPortal() {
  const [view, setView] = useState<
    "loading" | "register" | "attendance" | "recovery"
  >("loading");

  const [studentId, setStudentId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [recoveryPin, setRecoveryPin] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const [labRooms, setLabRooms] = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [isLogging, setIsLogging] = useState(false);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isNameLocked, setIsNameLocked] = useState(false);

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

  async function handleIdCheck(forcedId?: string) {
    // Use the forcedId if provided, otherwise use the state studentId
    const idToSearch = typeof forcedId === "string" ? forcedId : studentId;

    if (idToSearch.length >= 4) {
      const response = await checkRevokedStatus(idToSearch);
      if (response.isRevoked) {
        setFirstName(response.firstName || "");
        setLastName(response.lastName || "");
        setIsNameLocked(true); // Lock the fields
        setMessage(
          "Account found. Please enter a new PIN to register this device.",
        );
        setIsError(false);
      } else {
        setIsNameLocked(false); // Unlock for new users
      }
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    if (recoveryPin.length !== 4 || isNaN(Number(recoveryPin))) {
      setIsError(true);
      setMessage("Recovery PIN must be exactly 4 numbers.");
      return;
    }

    setIsRegistering(true);
    setMessage("");
    setIsError(false);

    try {
      const keyPair = await window.crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign", "verify"],
      );
      const exportedPublicKey = await window.crypto.subtle.exportKey(
        "spki",
        keyPair.publicKey,
      );
      const publicKeyArray = Array.from(new Uint8Array(exportedPublicKey));
      const publicKeyBase64 = btoa(String.fromCharCode(...publicKeyArray));

      const dbResponse = await registerStudentToDatabase({
        studentId,
        firstName,
        lastName,
        publicKey: publicKeyBase64,
        recoveryPin,
      });

      if (dbResponse.success) {
        await set("student_private_key", keyPair.privateKey);
        await set("student_id", studentId);

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
      setMessage(
        "Server Error: Database connection failed. Keys were NOT saved.",
      );
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
        encodedMessage,
      );
      const signatureArray = Array.from(new Uint8Array(rawSignature));
      const signatureBase64 = btoa(String.fromCharCode(...signatureArray));

      const response = await submitAttendance({
        studentId: storedStudentId as string,
        labRoom: selectedRoom,
        timestamp: timestamp,
        signature: signatureBase64,
      });

      if (response.success) {
        setMessage(response.message);
      } else {
        setIsError(true);
        setMessage(response.message);

        if (
          response.message.includes("Student not found") ||
          response.message.includes("DEVICE_REVOKED") ||
          response.message.includes("Digital signature verification failed")
        ) {
          await del("student_private_key");
          await del("student_id");
          setTimeout(() => {
            setView("register");
            setIsError(false);
            setMessage(
              "Security key mismatch detected. Please register this device again.",
            );
          }, 2500);
        }
      }
    } catch (error) {
      console.error(error);
      setIsError(true);
      setMessage("An error occurred during verification.");
    } finally {
      setIsLogging(false);
    }
  }

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault();
    setIsRegistering(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await recoverStudentDevice(studentId, recoveryPin);

      if (response.success) {
        setMessage(response.message);

        // 1. Fetch the identity and lock the fields immediately BEFORE the screen changes
        await handleIdCheck(studentId);

        setTimeout(() => {
          setMessage("");
          // 2. We deliberately DO NOT clear the studentId here so it stays in the box
          setRecoveryPin("");
          // 3. Switch back to the register screen
          setView("register");
        }, 2000);
      } else {
        setIsError(true);
        setMessage(response.message);
      }
    } catch (error) {
      setIsError(true);
      setMessage("Failed to process recovery.");
    } finally {
      setIsRegistering(false);
    }
  }

  if (view === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Checking device security...
      </div>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8 border border-gray-100 relative">
        <a
          href="/"
          className="absolute top-6 left-6 text-sm text-gray-400 hover:text-blue-600 transition-colors"
        >
          &larr; Home
        </a>

        {view === "register" && (
          <div className="animate-in fade-in duration-300">
            <div className="text-center mb-8 mt-4">
              <h2 className="text-2xl font-bold text-gray-800">
                Register Device
              </h2>
              <p className="text-gray-500 mt-2 text-sm">
                One-time setup for ECC attendance tracking.
              </p>
            </div>
            <form onSubmit={handleRegister} className="space-y-4">
              <input
                type="text"
                placeholder="Student ID"
                className={`w-full px-4 py-3 rounded-lg border outline-none ${isNameLocked ? "bg-gray-200 text-gray-500 cursor-not-allowed border-transparent" : "bg-gray-50 border-gray-200"}`}
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                onBlur={() => handleIdCheck()}
                disabled={isNameLocked}
                required
              />
              <input
                type="text"
                placeholder="First Name"
                className={`w-full px-4 py-3 rounded-lg border outline-none ${isNameLocked ? "bg-gray-200 text-gray-500 cursor-not-allowed border-transparent" : "bg-gray-50 border-gray-200"}`}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isNameLocked}
                required
              />
              <input
                type="text"
                placeholder="Last Name"
                className={`w-full px-4 py-3 rounded-lg border outline-none ${isNameLocked ? "bg-gray-200 text-gray-500 cursor-not-allowed border-transparent" : "bg-gray-50 border-gray-200"}`}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isNameLocked}
                required
              />
              <input
                type="password"
                placeholder="Create 4-Digit Recovery PIN"
                maxLength={4}
                pattern="\d{4}"
                title="Must be exactly 4 numbers"
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 outline-none"
                value={recoveryPin}
                onChange={(e) => setRecoveryPin(e.target.value)}
                required
              />

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg mt-2"
              >
                {isRegistering ? "Registering..." : "Register Device"}
              </button>
            </form>

            {isNameLocked && (
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsNameLocked(false);
                    setStudentId("");
                    setFirstName("");
                    setLastName("");
                    setMessage("");
                  }}
                  className="text-xs text-gray-400 hover:text-blue-600 underline"
                >
                  Not your account? Clear and try again
                </button>
              </div>
            )}

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setView("recovery");
                  setMessage("");
                  setIsError(false);
                }}
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                Lost your device? Recover account
              </button>
            </div>
          </div>
        )}

        {view === "recovery" && (
          <div className="animate-in fade-in duration-300">
            <div className="text-center mb-8 mt-4">
              <h2 className="text-2xl font-bold text-gray-800">
                Device Recovery
              </h2>
              <p className="text-gray-500 mt-2 text-sm">
                Enter your PIN to revoke your old device.
              </p>
            </div>
            <form onSubmit={handleRecovery} className="space-y-4">
              <input
                type="text"
                placeholder="Student ID"
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 outline-none"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="4-Digit Recovery PIN"
                maxLength={4}
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 outline-none"
                value={recoveryPin}
                onChange={(e) => setRecoveryPin(e.target.value)}
                required
              />

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg mt-2"
              >
                {isRegistering ? "Processing..." : "Revoke Old Device"}
              </button>
            </form>
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setView("register");
                  setMessage("");
                  setIsError(false);
                }}
                className="text-sm text-gray-500 hover:underline font-medium"
              >
                Back to Registration
              </button>
            </div>
          </div>
        )}

        {view === "attendance" && (
          <div className="animate-in fade-in duration-300">
            <div className="text-center mb-8 mt-4">
              <h2 className="text-2xl font-bold text-gray-800">
                Log Attendance
              </h2>
              <p className="text-gray-500 mt-2 text-sm">
                Select your current lab room.
              </p>
            </div>
            <form onSubmit={handleLogAttendance} className="space-y-6">
              <select
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 outline-none cursor-pointer"
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select your lab room...
                </option>
                {labRooms.map((room, index) => (
                  <option key={index} value={room}>
                    {room}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isLogging || labRooms.length === 0}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-green-400 mt-4"
              >
                {isLogging ? "Verifying..." : "Log Attendance"}
              </button>
            </form>
          </div>
        )}

        {message && (
          <div
            className={`mt-6 p-4 rounded-lg text-sm font-medium border ${isError ? "bg-red-50 text-red-700 border-red-200" : message.includes("LATE") ? "bg-yellow-50 text-yellow-800 border-yellow-300" : "bg-green-50 text-green-700 border-green-200"}`}
          >
            {message}
          </div>
        )}
      </div>
    </main>
  );
}
