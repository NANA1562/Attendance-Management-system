"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";

/** Level picker that asks for a dashboard password only for seniors. */
export function SeniorPassword() {
  const [level, setLevel] = useState("junior");
  return (
    <>
      <Field label="Level" hint="Seniors can open the manager dashboard.">
        <Select name="level" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="junior">Junior</option>
          <option value="senior">Senior</option>
        </Select>
      </Field>
      {level === "senior" && (
        <Field label="Dashboard password" hint="At least 8 characters.">
          <Input name="password" type="password" minLength={8} required />
        </Field>
      )}
    </>
  );
}
