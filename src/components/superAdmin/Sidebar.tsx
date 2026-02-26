import React from "react";
import { NavLink } from "react-router-dom";
// import LogoutButton from "../LogoutButton";

import { BsArrowLeftShort, BsArrowRightShort } from "react-icons/bs";
import { IoSpeedometerOutline } from "react-icons/io5";
import { FaBuilding, FaUsersCog } from "react-icons/fa";
import { MdOutlineClass } from "react-icons/md";

import { RiUserSettingsLine } from "react-icons/ri";

import { useAuth } from "../../context/AuthContext";
import LogoutButton from "./LogoutButton";

interface SidebarProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Sidebar: React.FC<SidebarProps> = ({ open, setOpen }) => {
  const { auth } = useAuth();

  const handlerSidebar = () => setOpen(!open);

  const menuSuperAdmin = [
    {
      is_title_head: false,
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: <IoSpeedometerOutline />,
        },
      ],
    },
    {
      is_title_head: true,
      title_head: "Sistema",
      items: [
        { title: "Usuarios", url: "/users", icon: <RiUserSettingsLine /> },
        { title: "Empresas", url: "/businesses", icon: <FaBuilding /> },
      ],
    },
  ];

  return (
    <div className="position">
      <div
        className={`min-h-[100vh] z-20 bg-primary shadow-lg text-light-font p-5 pt-8 ${
          open
            ? "translate-x-0 md:translate-x-0 w-60 md:w-60"
            : "-translate-x-20 w-20 md:translate-x-0 md:block md:w-20"
        } duration-300 fixed md:relative block`}
      >
        {open ? (
          <BsArrowLeftShort
            onClick={handlerSidebar}
            className="hidden md:block bg-white text-primary rounded-full absolute -right-3 top-9 text-3xl border border-dark-purple cursor-pointer"
          />
        ) : (
          <BsArrowRightShort
            onClick={handlerSidebar}
            className="hidden md:block bg-white text-primary rounded-full absolute -right-3 top-9 text-3xl border border-primary cursor-pointer"
          />
        )}

        <div className="w-full py-[20px] inline-flex items-center gap-2 px-2 bg-gray-100 rounded">
          <img
            src="https://img.freepik.com/free-psd/3d-illustration-human-avatar-profile_23-2150671142.jpg"
            className="w-6 h-6 rounded-full block cursor-pointer mr-2"
            alt=""
          />
          <div className={`${!open && "scale-0"} overflow-hidden`}>
            <h1 className="text-lg font-bold">{auth?.user?.name}</h1>
            <h1 className="text-sm">{auth?.user?.email}</h1>
            <span className="text-sm font-bold">superadmin</span>
          </div>
        </div>

        <nav className="pt-2 flex flex-col gap-2 overflow-y-auto">
          {menuSuperAdmin.map((section, index) => (
            <div key={index}>
              {section.is_title_head && (
                <span className="text-secondary font-bold text-sm">
                  {section.title_head}
                </span>
              )}
              {section.items.map((item, idx) => (
                <NavLink
                  key={idx}
                  to={item.url}
                  className={({ isActive }) =>
                    isActive
                      ? "bg-secondary text-primary font-bold text-sm p-2 flex gap-3 items-center rounded"
                      : "p-2 text-white text-sm hover:bg-secondary hover:text-primary rounded flex gap-3 items-center"
                  }
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className={`text-sm flex-1 ${!open && "hidden"}`}>
                    {item.title}
                  </span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <LogoutButton open={open} />
      </div>

      <div
        onClick={() => setOpen(false)}
        className={`${
          open ? "" : "hidden"
        } block md:hidden w-full bg-gray-900 opacity-50 absolute top-0 h-full left-0 z-10`}
      ></div>
    </div>
  );
};

export default Sidebar;
