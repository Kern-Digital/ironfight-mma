// Registriert scripts/lib/ts-loader.mjs — siehe dort.
import { register } from "node:module";
register("./ts-loader.mjs", import.meta.url);
