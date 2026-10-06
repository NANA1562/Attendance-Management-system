import { LinkButton } from "@/components/ui";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-3xl font-semibold">Staff Attendance</h1>
        <p className="mt-2 text-stone-600">Clock in on a shared tablet. See who's in, who's late and what got done.</p>
      </div>
      <div className="grid gap-3">
        <LinkButton href="/kiosk" className="py-4 text-base">Open the clock-in tablet</LinkButton>
        <LinkButton href="/manage/login" variant="secondary" className="py-4 text-base">Manager login</LinkButton>
        <LinkButton href="/setup" variant="secondary" className="py-4 text-base">Create a new business</LinkButton>
      </div>
    </main>
  );
}
