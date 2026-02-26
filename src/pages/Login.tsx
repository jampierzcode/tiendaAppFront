import { useEffect, useState } from "react";
import { Form, Input, Button, Card, message } from "antd";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const { auth, login, businessesByUser } = useAuth();
  const [error, setError] = useState<string | undefined | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (auth.user) {
      const role = auth?.user?.role?.name; // Supongamos que el rol está en user.role
      console.log(role);
      if (role === "superadmin") {
        navigate("/businesses"); // Redirigir a la ruta de usuarios
      } else if (role === "admin") {
        console.log(businessesByUser);
        if (businessesByUser !== null) {
          navigate(`/b/${businessesByUser[0].uuid}/products`); // Redirigir a la ruta de usuarios
        } else {
          message.warning(
            "Aun no cuentas con una empresa porfavor registra tu empresa"
          );
        }
      } else {
        navigate("/"); // Ruta por defecto
      }
    }
  }, [auth.user, navigate, businessesByUser]);
  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const result = await login(values.email, values.password);
      if (!result.success) {
        setError(result.message); // Mostrar el mensaje de error específico
      }
      setInterval(() => {
        setError(null);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      console.error("Error inesperado al iniciar sesión:", err);
      setError("Ocurrió un error inesperado. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <Card title="Iniciar Sesión" className="w-96 shadow-lg">
        <Form layout="vertical" onFinish={handleLogin}>
          {error ? (
            <h1 className="border p-2 border-red-500 text-red-500 rounded-full">
              {error}
            </h1>
          ) : null}
          <Form.Item
            label="Correo electrónico"
            name="email"
            rules={[{ required: true, message: "Ingresa tu correo" }]}
          >
            <Input placeholder="ejemplo@correo.com" />
          </Form.Item>

          <Form.Item
            label="Contraseña"
            name="password"
            rules={[{ required: true, message: "Ingresa tu contraseña" }]}
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              className="mt-2"
            >
              Ingresar
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
