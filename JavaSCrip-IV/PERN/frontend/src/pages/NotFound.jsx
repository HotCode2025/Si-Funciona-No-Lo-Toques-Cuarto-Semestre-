import { Link } from "react-router-dom";
import { Card } from "../components/ui";

function NotFound() {
  return (
    <Card>
      <h1
        className="bg-linear-to-b from-indigo-400 to-indigo-700 bg-clip-text
                   text-center text-8xl font-black tracking-tight text-transparent
                   sm:text-9xl"
      >
        404
      </h1>

      <p className="text-center text-2xl font-semibold text-zinc-100">
        No se encontró la página solicitada
      </p>

      <Link
        to="/"
        className="text-center text-sm font-medium text-indigo-400
                   transition hover:text-indigo-300"
      >
        Volver a la home
      </Link>
    </Card>
  );
}

export default NotFound;