"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type FieldValues, type Path, type UseFormProps } from "react-hook-form";
import type { ZodType } from "zod";
import { ApiError, errorMessage } from "@/lib/api/errors";

/** react-hook-form + zod on the client, with API validation errors mapped back onto the fields. */
export function useApiForm<T extends FieldValues>(schema: ZodType<T>, options: Omit<UseFormProps<T>, "resolver"> = {}) {
  const form = useForm<T>({ ...options, resolver: zodResolver(schema) });
  const [formError, setFormError] = useState<string | null>(null);

  const submitWith = (action: (values: T) => Promise<void>) =>
    form.handleSubmit(async (values) => {
      setFormError(null);
      try {
        await action(values);
      } catch (error) {
        if (error instanceof ApiError && error.body.errors) {
          let mapped = false;
          for (const [field, message] of Object.entries(error.fieldErrors())) {
            if (field in values) {
              form.setError(field as Path<T>, { message });
              mapped = true;
            }
          }
          if (!mapped) setFormError(error.message);
        } else {
          setFormError(errorMessage(error));
        }
      }
    });

  return { form, formError, setFormError, submitWith };
}
