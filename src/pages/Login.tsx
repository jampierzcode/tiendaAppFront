import { useEffect, useState } from "react";
import { Form, Input, Button, message } from "antd";
import { motion } from "motion/react";
import { TbAlertCircle, TbBrandWhatsapp, TbQrcode, TbBox } from "react-icons/tb";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const { auth, login, businessesByUser } = useAuth();
  const [error, setError] = useState<string | undefined | null>(null);
  const navigate = useNavigate();

  // El mensaje de error se borra solo, y el temporizador se cancela si el
  // componente se desmonta o si llega un error nuevo.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (auth.user) {
      const role = auth?.user?.role?.name;
      if (role === "superadmin") {
        navigate("/businesses");
      } else if (role === "admin") {
        if (businessesByUser && businessesByUser.length > 0) {
          navigate(`/b/${businessesByUser[0].uuid}/dashboard`);
        } else if (businessesByUser) {
          message.warning(
            "Aún no tienes una tienda registrada. Pide a tu administrador que te cree una."
          );
        }
      } else {
        navigate("/");
      }
    }
  }, [auth.user, navigate, businessesByUser]);

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const result = await login(values.email, values.password);
      if (!result.success) setError(result.message);
    } catch (err) {
      console.error("Error inesperado al iniciar sesión:", err);
      setError("Ocurrió un error inesperado. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const ventajas = [
    { icono: <TbQrcode />, texto: "Tu catálogo en un QR, siempre actualizado" },
    { icono: <TbBrandWhatsapp />, texto: "Los pedidos te llegan por WhatsApp" },
    { icono: <TbBox />, texto: "Stock que cuadra entre mostrador y online" },
  ];

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel de marca */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-brand-800 to-brand-950 lg:block">
        {/* Formas del fondo, como en la proforma */}
        <div className="absolute -left-16 -top-16 h-72 w-72 rounded-full bg-white/[0.07]" />
        <div className="absolute bottom-10 -right-24 h-96 w-96 rounded-full bg-brand-400/20" />
        <div className="absolute left-1/3 top-1/2 h-40 w-40 rounded-full bg-sky-brand/10" />

        <div className="relative flex h-full flex-col justify-between p-12">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50"
            >
              Sistema de gestión
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="mt-3 max-w-md text-[38px] font-extrabold leading-[1.1] text-white"
            >
              Tu tienda de ropa, ordenada en un solo lugar.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.14 }}
              className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/70"
            >
              Vende en físico y online, controla tu stock y envía a todo el Perú.
            </motion.p>
          </div>

          <ul className="space-y-3">
            {ventajas.map((v, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.25 + i * 0.08 }}
                className="flex items-center gap-3 text-[14px] text-white/85"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/12 text-lg text-white ring-1 ring-white/15">
                  {v.icono}
                </span>
                {v.texto}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[380px]"
        >
          <div className="mb-8">
            <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-extrabold text-white">
              T
            </div>
            <h2 className="text-[26px] font-extrabold leading-tight text-ink">
              Entra a tu panel
            </h2>
            <p className="mt-1.5 text-[14px] text-muted">
              Gestiona tu catálogo, tus pedidos y tu tienda online.
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-start gap-2.5 rounded-xl bg-danger-bg px-3.5 py-3 text-[13px] text-danger"
              role="alert"
            >
              <TbAlertCircle className="mt-0.5 shrink-0 text-base" />
              <span>{error}</span>
            </motion.div>
          )}

          <Form layout="vertical" onFinish={handleLogin} requiredMark={false} size="large">
            <Form.Item
              label="Correo electrónico"
              name="email"
              rules={[
                { required: true, message: "Escribe tu correo" },
                { type: "email", message: "Ese correo no parece válido" },
              ]}
            >
              <Input placeholder="tu@correo.com" autoComplete="email" autoFocus />
            </Form.Item>

            <Form.Item
              label="Contraseña"
              name="password"
              rules={[{ required: true, message: "Escribe tu contraseña" }]}
            >
              <Input.Password placeholder="••••••••" autoComplete="current-password" />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              className="mt-2 !h-11 !font-semibold"
            >
              Ingresar
            </Button>
          </Form>

          <p className="mt-8 text-center text-[12px] text-muted">
            ¿Problemas para entrar? Contacta al administrador de tu tienda.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
