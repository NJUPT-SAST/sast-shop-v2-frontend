export type StoreCreateField = "name" | "address";
export type StoreCreateFieldErrors = Partial<
  Record<StoreCreateField, "required">
>;

export type StoreCreateFieldsValidation =
  | {
      ok: true;
      fields: { name: string; address: string };
    }
  | {
      ok: false;
      errors: StoreCreateFieldErrors;
    };

export function validateStoreCreateFields({
  name,
  address,
}: {
  name: string;
  address: string;
}): StoreCreateFieldsValidation {
  const fields = { name: name.trim(), address: address.trim() };
  const errors: StoreCreateFieldErrors = {};

  if (!fields.name) errors.name = "required";
  if (!fields.address) errors.address = "required";

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, fields };
}
