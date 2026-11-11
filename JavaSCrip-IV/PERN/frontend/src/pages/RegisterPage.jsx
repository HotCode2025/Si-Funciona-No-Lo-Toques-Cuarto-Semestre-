import { useForm } from "react-hook-form";
import { Input, Button, Card } from "../components/ui/index.js";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function RegisterPage() {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm();

    const navigate = useNavigate();
    const { signup, error } = useAuth();
    const onSubmit = async (data) => {
        console.log("Registro:", data);
        const response = await signup(data);
        console.log("Respuesta del registro:", response);
        if (error === null) {
            navigate("/profile");
        }
    };

    return (
        <Card>
            <h1 className="text-center text-2xl font-bold text-zinc-100">Registro</h1>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                    <Input
                        id="name"
                        label="Nombre"
                        placeholder="Tu nombre"
                        autoComplete="name"
                        error={errors.name?.message}
                        {...register("name", { required: "El nombre es obligatorio" })}
                    />
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
                        autoComplete="new-password"
                        error={errors.password?.message}
                        {...register("password", {
                            required: "La contraseña es obligatoria",
                            minLength: { value: 8, message: "Mínimo 8 caracteres" },
                        })}
                    />
                </div>

                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
                </Button>
            </form>
            <span className="text-sm text-zinc-400">
                ¿Ya tenés cuenta?{" "}
                <a href="/login" className="font-semibold text-indigo-500">
                    Iniciá sesión
                </a>
            </span>
        </Card>
    );
}

export default RegisterPage;