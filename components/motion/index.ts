/**
 * Die Bewegungs-Schicht der App. Alles, was sich anfühlt, kommt von hier.
 *
 * Sinn dieser einen Tür: kein `import { motion } from "framer-motion"`
 * mehr in Seiten und Bereichs-Komponenten. Wer die Bibliothek direkt
 * anfasst, umgeht die Touch- und Reduced-Motion-Sperren — und beim
 * Capacitor-Wrap oder einem späteren Wechsel der Animations-Bibliothek
 * müsste jede dieser Stellen einzeln angefasst werden.
 *
 * Ausnahmen (dürfen framer-motion direkt nutzen): Diagramme mit eigenen
 * Pfad-Animationen und die Helix — dort ist die Bewegung der Inhalt.
 */

export { Pressable, PressableBox } from "./Pressable";
export {
  Stagger,
  StaggerItem,
  StaggerList,
  StaggerFlow,
  FlowItem,
} from "./Stagger";
export { Collapse, Pop, MorphSwap } from "./Morph";
export { SheetShell, useLetzterWert } from "./SheetShell";
export { useMotionCapability } from "./useMotionCapability";
export type { MotionCapability } from "./useMotionCapability";
