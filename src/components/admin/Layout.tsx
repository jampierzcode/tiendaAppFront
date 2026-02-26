import { useState } from "react";
import Sidebar from "./Sidebar";
import TopNavigation from "./TopNavigation";
import { Outlet } from "react-router-dom";

export default function AdminLayout() {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex">
      <Sidebar open={open} setOpen={setOpen} />
      <div className="w-full app-container h-[100vh]">
        <TopNavigation open={open} setOpen={setOpen} />
        <div className="px-6 py-12">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
