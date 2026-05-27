"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/Button";
import {
  FormField,
  FormInput,
} from "@/features/inventory-management/components/ui/FormField";
import {
  addContactSchema,
  type AddContactFormValues,
} from "@/features/inventory-management/schemas/add-contact";

type AddContactFormProps = {
  onSave: (values: AddContactFormValues) => void;
  onCancel: () => void;
};

export function AddContactForm({ onSave, onCancel }: AddContactFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddContactFormValues>({
    resolver: zodResolver(addContactSchema),
    defaultValues: {
      company: "",
      name: "",
      tel: "",
      email: "",
      area: "",
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((values) => {
        onSave(values);
        toast.success("Contact saved to database");
      })}
    >
      <FormField label="Company Name" error={errors.company?.message}>
        <FormInput placeholder="Company Name" {...register("company")} />
      </FormField>
      <FormField label="Contact Name" error={errors.name?.message}>
        <FormInput placeholder="Contact Name" {...register("name")} />
      </FormField>
      <FormField label="Phone" error={errors.tel?.message}>
        <FormInput placeholder="Phone" {...register("tel")} />
      </FormField>
      <FormField label="Email" error={errors.email?.message}>
        <FormInput placeholder="Email" type="email" {...register("email")} />
      </FormField>
      <FormField label="Area / Region" error={errors.area?.message}>
        <FormInput placeholder="Area / Region" {...register("area")} />
      </FormField>
      <div className="flex flex-col gap-2 pt-2">
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          Save to Database
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
