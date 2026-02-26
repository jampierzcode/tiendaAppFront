import { MdLogout } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

type LogoutButtonProps = {
  open: boolean;
};

export default function LogoutButton({ open }: LogoutButtonProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <button
      onClick={handleLogout}
      className="mt-4 bg-white transition-all duration-300 hover:bg-light-purple hover:text-dark-purple p-2 text-sm rounded flex gap-3 items-center w-full"
    >
      <span className="block float-left text-2xl text-red-500">
        <MdLogout />
      </span>
      <span
        className={`text-red-500 text-base text-start font-medium flex-1 ${
          !open ? "hidden" : ""
        }`}
      >
        Salir
      </span>
    </button>
  );
}
