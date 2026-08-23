import { createMiddleware } from "@tanstack/react-start";
import { toPublicErrorMessage } from "./public-error";

/** Sunucu fonksiyonu hatalarını HTTPError yerine anlamlı Error olarak iletir. */
export const publicServerFnErrors = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    try {
      return await next();
    } catch (error) {
      throw new Error(toPublicErrorMessage(error));
    }
  },
);
