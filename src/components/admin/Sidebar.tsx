import React, { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { Select, Spin } from "antd";
import { BsArrowLeftShort, BsArrowRightShort } from "react-icons/bs";
import { IoSpeedometerOutline } from "react-icons/io5";

import { useAuth } from "../../context/AuthContext";
import { apiTienda } from "../../api/apiTienda";
import LogoutButton from "./LogoutButton";
import { BiAddToQueue, BiCategoryAlt, BiPackage } from "react-icons/bi";

interface SidebarProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Sidebar: React.FC<SidebarProps> = ({ open, setOpen }) => {
  const { auth } = useAuth();
  const { uuid_business } = useParams();
  const navigate = useNavigate();

  const [businesses, setBusinesses] = useState<
    { uuid: string; name: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const handlerSidebar = () => setOpen(!open);

  // 🔹 Trae empresas del usuario logueado
  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const res = await apiTienda.get(`/businesses/byUser`);
        setBusinesses(res.data.data || []);
      } catch (error) {
        console.error("Error fetching businesses:", error);
      } finally {
        setLoading(false);
      }
    };
    if (auth.user?.id) fetchBusinesses();
  }, [auth.user?.id]);

  const menu = [
    {
      is_title_head: false,
      items: [
        {
          title: "Dashboard",
          url: `/b/${uuid_business}/dashboard`,
          icon: <IoSpeedometerOutline />,
        },
      ],
    },
    {
      is_title_head: true,
      title_head: "Catalogo",
      items: [
        {
          title: "Productos",
          url: `/b/${uuid_business}/products`,
          icon: <BiPackage />,
        },
        {
          title: "Categorías",
          url: `/b/${uuid_business}/categories`,
          icon: <BiCategoryAlt />,
        },
        {
          title: "Atributos",
          url: `/b/${uuid_business}/attributes`,
          icon: <BiAddToQueue />,
        },
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
        {/* 🔹 Selector de empresa */}
        {open && (
          <div className="mb-4">
            {loading ? (
              <Spin size="small" />
            ) : (
              <Select
                value={uuid_business}
                onChange={(value) => navigate(`/b/${value}/products`)}
                className="w-full"
                size="middle"
                options={businesses.map((b) => ({
                  label: b.name,
                  value: b.uuid,
                }))}
              />
            )}
          </div>
        )}
        {/* 🔹 Usuario */}
        <div className="w-full py-[20px] inline-flex items-center gap-2 px-2 bg-gray-100 rounded mb-4">
          <img
            src="https://img.freepik.com/free-psd/3d-illustration-human-avatar-profile_23-2150671142.jpg"
            className="w-6 h-6 rounded-full block cursor-pointer mr-2"
            alt=""
          />
          <div className={`${!open && "scale-0"} overflow-hidden`}>
            <h1 className="text-lg font-bold">{auth?.user?.name}</h1>
            <h1 className="text-sm">{auth?.user?.email}</h1>
            <span className="text-sm font-bold">admin</span>
          </div>
        </div>

        {/* 🔹 Menú */}
        <nav className="pt-2 flex flex-col gap-2">
          {menu.map((section, index) => (
            <div key={index}>
              {section.is_title_head && (
                <span className="text-secondary font-bold w-full text-sm text-nowrap text-ellipsis overflow-hidden">
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

      {/* 🔹 Fondo oscuro al abrir en móvil */}
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
