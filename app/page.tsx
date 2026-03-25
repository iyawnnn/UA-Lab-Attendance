"use client";

import { useState } from "react";
import { set } from "idb-keyval";
import { registerStudentToDatabase } from "./actions";

export default function StudentRegistration() {
  const [studentId, setStudentId] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [isError, setIsError] = useState<boolean>(false);

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsRegistering(true);
    setMessage("");
    setIsError(false);

    try {
      // Generate the ECC Key Pair (P-256 Curve)
      const keyPair = await window.crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        false, 
        ["sign", "verify"]
      );

      // Save private key and ID to the browser's IndexedDB
      await set("student_private_key", keyPair.privateKey);
      await set("student_id", studentId);

      // Export public key to send to the database
      const exportedPublicKey = await window.crypto.subtle.exportKey(
        "spki",
        keyPair.publicKey
      );
      
      const publicKeyArray = Array.from(new Uint8Array(exportedPublicKey));
      const publicKeyBase64 = btoa(String.fromCharCode(...publicKeyArray));

      const dbResponse = await registerStudentToDatabase({
        studentId: studentId,
        firstName: firstName,
        lastName: lastName,
        publicKey: publicKeyBase64,
      });

      if (dbResponse.success) {
        setMessage(dbResponse.message);
        setStudentId("");
        setFirstName("");
        setLastName("");
      } else {
        setIsError(true);
        setMessage(dbResponse.message);
      }

    } catch (error) {
      console.error("Registration failed:", error);
      setIsError(true);
      setMessage("An error occurred during secure key generation.");
    } finally {
      setIsRegistering(false);
    }
  }

  return (
    <main className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8 border border-gray-100">
        
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Student Registration</h2>
          <p className="text-gray-500 mt-2 text-sm">Register your device to enable secure attendance tracking.</p>
        </div>
        
        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label htmlFor="studentId" className="block text-sm font-semibold text-gray-700 mb-1">Student ID</label>
            <input
              type="text"
              id="studentId"
              className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              placeholder="e.g. 2024-12345"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="firstName" className="block text-sm font-semibold text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              id="firstName"
              className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              placeholder="Juan"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-semibold text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              id="lastName"
              className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              placeholder="Dela Cruz"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md disabled:bg-blue-400 mt-2"
            disabled={isRegistering}
          >
            {isRegistering ? "Registering Device..." : "Register Device"}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-4 rounded-lg text-sm font-medium ${isError ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
            {message}
          </div>
        )}

      </div>
    </main>
  );
}