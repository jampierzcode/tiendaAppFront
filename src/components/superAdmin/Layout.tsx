import React, { useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import TopNavigation from "./TopNavigation";

interface LayoutProps {
  children: ReactNode;
}

const SuperAdminLayout: React.FC<LayoutProps> = ({ children }) => {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex">
      <Sidebar open={open} setOpen={setOpen} />
      <div className="w-full app-container h-[100vh]">
        <TopNavigation open={open} setOpen={setOpen} />
        <div className="px-6 py-12">{children}</div>
      </div>
    </div>
  );
};

export default SuperAdminLayout;
