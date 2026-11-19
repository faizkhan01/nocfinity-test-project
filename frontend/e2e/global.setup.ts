import { expect, test as setup } from "@playwright/test";
import { AUTH, SUPER_ADMIN, registerCustomer } from "./support";

// Sessions are created once through the BFF (the same route the forms use) and reused by the specs.
setup("customer session", async ({ request, baseURL }) => {
  await registerCustomer(request, baseURL!);
  await request.storageState({ path: AUTH.customer });
});

setup("super admin session", async ({ request, baseURL }) => {
  const response = await request.post("/bff/admin/auth/login", { headers: { Origin: baseURL! }, data: SUPER_ADMIN });
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  expect(body.data?.two_factor_required, "Turn off 2FA for the seeded Super Admin to run the admin specs").toBeFalsy();
  await request.storageState({ path: AUTH.admin });
});
