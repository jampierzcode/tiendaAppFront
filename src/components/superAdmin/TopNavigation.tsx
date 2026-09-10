import { TbMenu2 } from "react-icons/tb";
import { useAuth } from "../../context/AuthContext";

export default function TopNavigation({ abrirMovil }: { abrirMovil: () => void }) {
  const { auth } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <button
          onClick={abrirMovil}
          aria-label="Abrir menú"
          className="rounded-lg p-2 text-ink-soft transition hover:bg-canvas md:hidden"
        >
          <TbMenu2 className="text-xl" />
        </button>
        <p className="ml-auto text-[13px] text-muted">
          Conectado como <span className="font-semibold text-ink">{auth.user?.email}</span>
        </p>
      </div>
    </header>
  );
}
