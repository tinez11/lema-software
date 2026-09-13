// @ts-check
import nextjs from "@prisma/composer/nextjs";
import { compute } from "@prisma/composer-prisma-cloud";

export default compute({
  name: "lemas-software",
  deps: {},
  build: nextjs({ module: import.meta.url, appDir: "." }),
});
