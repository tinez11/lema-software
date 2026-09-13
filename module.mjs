// @ts-check
import { module } from "@prisma/composer";
import lemasSoftwareService from "./service.mjs";

export default module("lema-software", ({ provision }) => {
  provision(lemasSoftwareService, { id: "lemassoftware" });
});
