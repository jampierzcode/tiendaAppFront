import React from "react";
import { BsBellFill, BsJustifyRight } from "react-icons/bs";
import dayjs from "dayjs";
import { useAuth } from "../../context/AuthContext";

interface TopNavigationProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const TopNavigation: React.FC<TopNavigationProps> = ({ open, setOpen }) => {
  const { auth } = useAuth();
  const lastConnection = dayjs().format("DD/MM • HH:mm");

  return (
    <>
      <div className="hidden bg-white lg:block p-6 border-b-2 border-gray-8">
        <div className="hidden lg:flex items-center justify-between">
          <div>
            <h1 className="text-gray-2 text-xl font-semibold">
              ¡Hola, {auth?.user?.name}!
            </h1>
            <span className="text-gray-5 text-xs rounded-lg bg-gray-9 px-3">
              Tu última conexión: {lastConnection}
            </span>
          </div>

          <div className="flex items-center">
            <div className="relative cursor-pointer">
              <div className="rounded-full bg-dark-purple text-white text-xs flex items-center justify-center w-5 h-5 absolute -top-2 -right-2">
                2
              </div>
              <BsBellFill className="text-xl ml-2 text-gray-400" />
            </div>

            <div className="ml-3 flex items-center">
              <div className="flex flex-row items-center">
                <div className="rounded-full border-2 border-gray-2 h-10 w-10 flex justify-center items-center">
                  <span className="text-gray-2 text-sm font-semibold uppercase">
                    {auth?.user?.name?.substring(0, 2)}
                  </span>
                </div>
                <div className="flex flex-col ml-2">
                  <h3 className="text-sm font-semibold">{auth?.user?.name}</h3>
                  <span className="text-gray-5 text-xs">
                    {auth?.user?.email}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="block md:hidden p-6">
        <BsJustifyRight
          onClick={() => setOpen(!open)}
          className="bg-white text-dark-purple text-3xl cursor-pointer"
        />
      </div>
    </>
  );
};

export default TopNavigation;
