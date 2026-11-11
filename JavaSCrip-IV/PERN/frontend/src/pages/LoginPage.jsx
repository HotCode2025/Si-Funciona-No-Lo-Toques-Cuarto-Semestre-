import { useForm } from "react-hook-form";
import { Input, Button, Card } from "../components/ui/index.js";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";   

function LoginPage() {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm();

    const navigate = useNavigate();
    const { signin, error, clearError } = useAuth();

    const onSubmit = async (data) => {
        console.log("Inicio de sesión:", data);
        const response = await signin(data);
        console.log("Respuesta del inicio de sesión:", response);
        if (error === null) {
            navigate("/profile");
        } 
    };

    return (
        <Card>
            <h1 className="text-center text-2xl font-bold text-zinc-100">Inicio de sesión</h1>
            {error && (
                <span className="text-sm text-red-500">{error}</span>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                    <Input
                        id="email"
                        type="email"
                        label="Email"
                        placeholder="tu@email.com"
                        autoComplete="email"
                        error={errors.email?.message}
                        {...register("email", {
                            required: "El email es obligatorio",
                            pattern: {
                                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                message: "Ingresá un email válido",
                            },
                        })}
                    />
                    <Input
                        id="password"
                        type="password"
                        label="Contraseña"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        error={errors.password?.message}
                        {...register("password", {
                            required: "La contraseña es obligatoria",
                            minLength: { value: 8, message: "Mínimo 8 caracteres" },
                        })}
                    />
                </div>

                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
                </Button>
            </form>
            <span className="text-sm text-zinc-400">
                ¿No tenés cuenta?{" "}
                <a href="/register" className="font-semibold text-indigo-500">
                    Registrate
                </a>
            </span>
        </Card>
    );
}

export default LoginPage;
