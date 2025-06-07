import { env } from "@/env";
import { passwordStore } from "@/stores/password-store";
import { z } from "zod";

function getFullPath(path: string) {
  return `${env.NEXT_PUBLIC_API_URL}${path}`;
}

function getFetchOptions(method: Method): RequestInit {
  return {
    method: method,
    cache: "reload",
    headers: new Headers({
      "content-type": "application/json; charset=utf-8",
      accept: "application/json",
      "x-app-password": passwordStore.getState().password,
    }),
  };
}

const apiResSchema = z.object({
  message: z.string().nullable(),
  data: z.any(),
});

async function handleRes(res: Response): Promise<unknown> {
  const data = await res.json();
  const parsed = apiResSchema.parse(data);

  if (res.ok) {
    return parsed.data as unknown;
  } else {
    throw new Error(
      parsed.message ?? "Request failed: " + res.status.toString()
    );
  }
}

/**
 * GET has no params because shouldn't
 * ever need to pass a body to GET req
 */
export async function GET(path: string) {
  const res = await fetch(getFullPath(path), getFetchOptions("GET"));
  return handleRes(res);
}

type Method = "GET" | "PATCH" | "POST" | "DELETE";

function getOtherMethods(method: Method) {
  return async <T>(
    path: string,
    options?: {
      body: T;
    }
  ) => {
    const optionsOut = getFetchOptions(method);

    if (options?.body) {
      optionsOut.body = JSON.stringify(options.body);
    }

    const res = await fetch(getFullPath(path), optionsOut);
    return handleRes(res);
  };
}

/**
 * These 3 are identical
 */
export const PATCH = getOtherMethods("PATCH");
export const POST = getOtherMethods("POST");
export const DELETE = getOtherMethods("DELETE");
