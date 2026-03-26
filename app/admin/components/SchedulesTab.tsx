"use client";

import { useState, useEffect } from "react";
import { Schedule } from "../types";

export default function SchedulesTab({ schedules }: { schedules: Schedule[] }) {
  const [dayFilter, setDayFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [dayFilter, roomFilter]);

  const uniqueRooms = Array.from(new Set(schedules.map(s => s.lab_room)));
  const uniqueDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const filteredSchedules = schedules.filter(sched => {
    const matchesRoom = roomFilter === "" || sched.lab_room === roomFilter;
    const matchesDay = dayFilter === "" || sched.date === dayFilter;
    return matchesRoom && matchesDay;
  });

  const totalPages = Math.max(1, Math.ceil(filteredSchedules.length / itemsPerPage));
  const paginatedSchedules = filteredSchedules.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-4 items-center">
        <select className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none cursor-pointer" value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
          <option value="">All Days</option>
          {uniqueDays.map(day => <option key={day} value={day}>{day}</option>)}
        </select>
        <select className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none cursor-pointer" value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
          <option value="">All Facilities</option>
          {uniqueRooms.map(room => <option key={room} value={room}>{room}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedSchedules.map((sched) => (
          <div key={sched.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-md">{sched.date}</span>
              <span className="text-sm font-medium text-slate-500">{sched.schedule}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">{sched.course_code}</h3>
            <p className="text-sm text-slate-500 mb-5">Section {sched.section}</p>
            <div className="pt-4 border-t border-slate-100 flex flex-col space-y-2 text-sm">
              <div className="flex justify-between items-center"><span className="text-slate-500">Facility:</span><span className="text-slate-900 font-medium">{sched.lab_room}</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500">Instructor:</span><span className="text-slate-900 font-medium">{sched.professor_name}</span></div>
            </div>
          </div>
        ))}
        {paginatedSchedules.length === 0 && (<div className="col-span-full p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">No schedules match your filters.</div>)}
      </div>
      
      {filteredSchedules.length > 0 && (
        <div className="flex justify-between px-6 py-4 bg-transparent">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md disabled:opacity-50">Previous</button>
          <span className="text-sm text-slate-700 self-center">Page <span className="font-semibold">{currentPage}</span> of {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}