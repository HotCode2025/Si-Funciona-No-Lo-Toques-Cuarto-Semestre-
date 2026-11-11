import { FiInfo, FiLogIn, FiUserPlus, FiUser, FiCheckSquare, FiPlusSquare } from "react-icons/fi";

export const publicNavigation = [
    {
        name: "About",
        path: "/about",
        icon: FiInfo
    },
    {
        name: "Login",
        path: "/login",
        icon: FiLogIn
    },
    {
        name: "Registro",
        path: "/register",
        icon: FiUserPlus
    },
];

export const protectedNavigation = [
    {
        name: "About",
        path: "/about",
        icon: FiInfo
    },
    {
        name: "Perfil",
        path: "/profile",
        icon: FiUser
    },
    {
        name: "Tareas",
        path: "/tareas",
        icon: FiCheckSquare
    },
    {
        name: "Crear Tarea",
        path: "/tareas/crear",
        icon: FiPlusSquare
    }
];