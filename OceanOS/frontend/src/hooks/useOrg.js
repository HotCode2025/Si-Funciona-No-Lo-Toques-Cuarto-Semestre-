import { useDemo } from '../contexts/DemoContext.jsx';

/** La organización abierta en el panel. En la demo se elige desde la barra. */
export function useOrg() {
  return useDemo().org;
}
