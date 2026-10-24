import { createContext, useContext } from "react";
import { db, type Profile } from "./data";
import type { WeightUnit } from "./domain";
const Context = createContext<WeightUnit>("kg");
export const useWeightUnit = () => useContext(Context);
export const UnitProvider = Context.Provider;
export async function updateProfile(values: Partial<Profile>) {
  await db.transaction("rw", db.profile, async () => {
    await db.profile.put({
      ...(await db.profile.get("local")),
      id: "local",
      ...values,
    });
  });
}
export function UnitSettings({ unit }: { unit: WeightUnit }) {
  return (
    <section className="panel">
      <h2>体重单位</h2>
      <div className="segments">
        {(["kg", "斤"] as const).map((u) => (
          <button
            key={u}
            aria-pressed={unit === u}
            onClick={() =>
              void updateProfile({ weightUnit: u }).catch(() =>
                window.dispatchEvent(
                  new CustomEvent("daily-toast", {
                    detail: "单位保存失败，请重试",
                  }),
                ),
              )
            }
          >
            {u}
          </button>
        ))}
      </div>
    </section>
  );
}
