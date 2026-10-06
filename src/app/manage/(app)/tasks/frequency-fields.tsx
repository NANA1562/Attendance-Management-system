"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import { DAY_SHORT } from "@/lib/format";

const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** Frequency picker that shows only the inputs that frequency needs. */
export function FrequencyFields({ today }: { today: string }) {
  const [frequency, setFrequency] = useState("daily");
  return (
    <>
      <Field label="How often">
        <Select name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
          <option value="daily">Every working day</option>
          <option value="specific_days">Specific days of the week</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="one_time">One time</option>
        </Select>
      </Field>
      {(frequency === "specific_days" || frequency === "weekly") && (
        <Field label="On">
          <div className="flex flex-wrap gap-2">
            {WEEK.map((d) => (
              <label
                key={d}
                className="cursor-pointer select-none rounded-[9px] border border-line-strong bg-surface px-2.5 py-1 text-[13px] font-medium text-ink-2 shadow-card transition has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white"
              >
                <input type="checkbox" name="daysOfWeek" value={d} className="sr-only" /> {DAY_SHORT[d]}
              </label>
            ))}
          </div>
        </Field>
      )}
      {frequency === "monthly" && (
        <Field label="Day of the month"><Input type="number" name="dayOfMonth" min={1} max={31} defaultValue={1} /></Field>
      )}
      {frequency === "one_time" && (
        <Field label="Date"><Input type="date" name="oneTimeDate" defaultValue={today} /></Field>
      )}
    </>
  );
}
